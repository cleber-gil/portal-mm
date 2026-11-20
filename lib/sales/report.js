import { fetchStock, indexStockByProduct, computeTurnover } from "./turnover";
import { fetchSales } from "../totvs/sales";

// cache em memória por instância — evita rebater no TOTVS a cada troca de filtro/exportação
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutos
const cache = new Map(); // `${start}|${end}` -> { data, expires }

function pick(obj, keys, fallback) {
  if (!obj) return fallback;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return fallback;
}

export function collectionOf(referenceCode) {
  if (!referenceCode) return "—";
  const m = /^([A-Za-z]{1,2}\d{2})/.exec(String(referenceCode).trim());
  return m ? m[1].toUpperCase() : "—";
}

export function defaultDates() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

async function fetchRawSales(start, end) {
  const key = `${start}|${end}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;
  const data = await fetchSales(start, end);
  cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
  return data;
}

// nomes reais confirmados direto na API (/api/sales): date, type ("venda" | "devolucao"),
// branchCode, branchName, clientCode, clientName, clientDoc, productCode, productName,
// reference, referenceName, color, size, sellerCode, quantity, grossValue, discountValue, netValue
function normalizeSale(raw) {
  const referenceCode = pick(raw, ["reference", "referenceCode"], "");
  const type = String(pick(raw, ["type"], "venda")).toLowerCase();
  return {
    isReturn: type === "devolucao" || type === "devolução",
    branchCode: String(pick(raw, ["branchCode", "branch"], "")),
    branchName: pick(raw, ["branchName", "branch", "description"], "—"),
    personCode: String(pick(raw, ["clientCode", "personCode"], "")),
    personName: pick(raw, ["clientName", "personName", "name"], "—"),
    document: pick(raw, ["clientDoc", "cpfCnpj", "document", "cgcCpf"], ""),
    productCode: pick(raw, ["productCode"], ""),
    referenceCode,
    collection: collectionOf(referenceCode),
    family: pick(raw, ["family"], "Sem família"),
    description: pick(raw, ["referenceName", "productName", "description", "productDescription"], "—"),
    color: pick(raw, ["color", "colorName"], "—"),
    size: pick(raw, ["size", "sizeName"], "—"),
    seller: pick(raw, ["sellerName", "seller", "sellerCode"], ""),
    quantity: Number(pick(raw, ["quantity", "qty"], 0)) || 0,
    gross: Number(pick(raw, ["grossValue"], 0)) || 0,
    net: Number(pick(raw, ["netValue", "value"], 0)) || 0,
  };
}

// ---------- vendas entre empresas do grupo ----------
// Detecta pelo nome do cliente (razão social do grupo) e pela raiz do CNPJ (8 primeiros dígitos):
// qualquer cliente com a mesma raiz de CNPJ de uma filial ou de um cliente do grupo é tratado como interno.
const GROUP_NAME_RE = new RegExp(
  process.env.GROUP_NAME_PATTERN || "^(MEDEIROS VESTUARIO|MM INDUSTRIA DE VESTUARIO|MARTHA MEDEIROS)",
  "i"
);
const digits = (v) => String(v || "").replace(/\D/g, "");
const cnpjRoot = (v) => {
  const d = digits(v);
  return d.length === 14 ? d.slice(0, 8) : "";
};

export function markIntercompany(rawSales, sales) {
  const roots = new Set();
  for (const r of rawSales) {
    const root = cnpjRoot(r.branchDoc);
    if (root) roots.add(root);
  }
  for (const s of sales) {
    if (GROUP_NAME_RE.test(s.personName)) {
      const root = cnpjRoot(s.document);
      if (root) roots.add(root);
    }
  }
  for (const s of sales) {
    const root = cnpjRoot(s.document);
    s.intercompany = GROUP_NAME_RE.test(s.personName) || (root !== "" && roots.has(root));
  }
  return sales;
}

export const SCOPES = [
  { id: "clientes", name: "Clientes (sem o grupo)" },
  { id: "grupo", name: "Só entre empresas do grupo" },
  { id: "todos", name: "Tudo" },
];

function uniqueBy(list, keyFn, mapFn) {
  const seen = new Map();
  for (const item of list) {
    const k = keyFn(item);
    if (k && !seen.has(k)) seen.set(k, mapFn(item));
  }
  return [...seen.values()];
}

// soma líquida: devolução entra com sinal negativo (é o que a API original já fazia
// no seu totals — confirmei comparando os dois: vendas - devoluções bate certinho)
function signedQty(s) {
  return s.isReturn ? -s.quantity : s.quantity;
}
function signedGross(s) {
  return s.isReturn ? -s.gross : s.gross;
}
function signedNet(s) {
  return s.isReturn ? -s.net : s.net;
}

function groupSum(list, keyFn, extraFn) {
  const map = new Map();
  for (const s of list) {
    const k = keyFn(s) || "—";
    if (!map.has(k)) {
      map.set(k, { key: k, ...extraFn(s), quantity: 0, gross: 0, net: 0 });
    }
    const row = map.get(k);
    row.quantity += signedQty(s);
    row.gross += signedGross(s);
    row.net += signedNet(s);
  }
  return [...map.values()];
}

// filtros/params: { start, end, branch, collection, client, family, scope, allowedBranches }
// allowedBranches: null = todas; array de códigos = só essas filiais (permissão do usuário)
// scope: "clientes" (padrão, exclui vendas entre empresas do grupo) | "grupo" | "todos"
// branch = branchCode (string); collection = prefixo tipo "S26"; client = personCode (string)
export async function getReport({ start, end, branch, collection, client, family, scope, allowedBranches = null }) {
  const raw = await fetchRawSales(start, end);
  const rawSales = Array.isArray(raw?.sales) ? raw.sales : [];
  // a detecção de vendas do grupo usa o período inteiro (todas as filiais) antes de restringir
  const allowed = Array.isArray(allowedBranches) ? new Set(allowedBranches.map(String)) : null;
  const allSales = markIntercompany(rawSales, rawSales.map(normalizeSale)).filter(
    (s) => !allowed || allowed.has(String(s.branchCode))
  );
  const scopeId = SCOPES.some((x) => x.id === scope) ? scope : "clientes";
  if (branch && allowed && !allowed.has(String(branch))) branch = "";

  // opções de filtro sempre vêm do período completo (sem aplicar filial/coleção/cliente),
  // pra não sumir opções da lista quando o usuário já filtrou por outra coisa
  const branchOptions = uniqueBy(
    allSales,
    (s) => s.branchCode,
    (s) => ({ code: s.branchCode, name: s.branchName })
  ).sort((a, b) => a.name.localeCompare(b.name));

  const collectionOptions = [...new Set(allSales.map((s) => s.collection))]
    .filter((c) => c && c !== "—")
    .sort();

  const familyOptions = [...new Set(allSales.map((s) => s.family))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const clientOptions = uniqueBy(
    allSales,
    (s) => s.personCode || s.personName,
    (s) => ({ code: s.personCode || s.personName, name: s.personName })
  ).sort((a, b) => a.name.localeCompare(b.name));

  // mesmos filtros, sem o escopo: base para o aviso de vendas entre empresas do grupo
  const baseFiltered = allSales.filter((s) => {
    if (branch && s.branchCode !== branch) return false;
    if (collection && s.collection !== collection) return false;
    if (family && s.family !== family) return false;
    if (client && (s.personCode || s.personName) !== client) return false;
    return true;
  });
  const intercompany = baseFiltered
    .filter((s) => s.intercompany)
    .reduce(
      (acc, s) => {
        acc.quantity += signedQty(s);
        acc.net += signedNet(s);
        if (!s.isReturn) acc.count += 1;
        acc.clients.add(s.personName);
        return acc;
      },
      { quantity: 0, net: 0, count: 0, clients: new Set() }
    );

  const filtered = baseFiltered.filter((s) => {
    if (scopeId === "clientes" && s.intercompany) return false;
    if (scopeId === "grupo" && !s.intercompany) return false;
    return true;
  });
  // totais: quantidade/valores já líquidos de devolução; "count" conta só as vendas
  // (devolução é um ajuste, não uma transação de venda nova) — mesma lógica do /api/sales original
  const totals = filtered.reduce(
    (acc, s) => {
      acc.quantity += signedQty(s);
      acc.gross += signedGross(s);
      acc.net += signedNet(s);
      if (!s.isReturn) acc.count += 1;
      return acc;
    },
    { quantity: 0, gross: 0, net: 0, count: 0 }
  );

  const returns = filtered
    .filter((s) => s.isReturn)
    .reduce(
      (acc, s) => {
        acc.quantity += s.quantity;
        acc.gross += s.gross;
        acc.net += s.net;
        acc.count += 1;
        return acc;
      },
      { quantity: 0, gross: 0, net: 0, count: 0 }
    );

  const byBranch = groupSum(filtered, (s) => s.branchCode, (s) => ({ name: s.branchName }));
  const byClient = groupSum(filtered, (s) => s.personCode || s.personName, (s) => ({
    name: s.personName,
    document: s.document,
    intercompany: s.intercompany,
  }));
  const byFamily = groupSum(filtered, (s) => s.family, (s) => ({ name: s.family }));
  const byProductRaw = groupSum(
    filtered,
    (s) => `${s.referenceCode}|${s.color}|${s.size}`,
    (s) => ({
      reference: s.referenceCode,
      collection: s.collection,
      family: s.family,
      name: s.description,
      color: s.color,
      size: s.size,
    })
  );

  // giro de estoque: cruza cada produto vendido com o saldo atual das lojas.
  // Se o estoque falhar, não derruba o painel de vendas — só fica sem os campos de giro.
  const periodDays =
    Math.max(1, Math.round((new Date(end) - new Date(start)) / 86400000) + 1) || 1;
  let stockError = "";
  let byProduct = byProductRaw;
  try {
    const stockJson = await fetchStock();
    const stockIndex = indexStockByProduct(stockJson);
    byProduct = byProductRaw.map((p) => {
      const stockEntry = stockIndex.get(p.key);
      const currentStock = stockEntry?.stock || 0;
      const turnover = computeTurnover({
        quantitySold: p.quantity,
        currentStock,
        periodDays,
      });
      return { ...p, ...turnover };
    });
  } catch (e) {
    stockError = e.message || String(e);
  }

  return {
    period: { start, end, days: periodDays },
    filters: { branch: branch || "", collection: collection || "", client: client || "", family: family || "", scope: scopeId },
    scope: scopeId,
    intercompany: { quantity: intercompany.quantity, net: intercompany.net, count: intercompany.count, clients: [...intercompany.clients] },
    branchOptions,
    collectionOptions,
    familyOptions,
    clientOptions,
    totals,
    returns,
    byBranch,
    byClient,
    byFamily,
    byProduct,
    familyError: raw?.familyError || "",
    stockError,
    sales: filtered,
  };
}
