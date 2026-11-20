// Estoque TOTVS Moda (portado do app estoque-marthamedeiros)
// - saldo físico por loja/matriz e saldo de consignação (product/v2/balances)
// - condicional e consignado em aberto pelas notas fiscais (fiscal/v2/invoices, FIFO)
const BASE = () =>
  (process.env.TOTVS_BASE_URL || "https://api-gateway.t8671ea.external.saas.totvsmoda.cloudtotvs.com.br").replace(/\/+$/, "");

export const STORE_BRANCHES = [2, 5, 6, 7, 9, 10, 11, 12];
export const ALL_BRANCHES = [1, ...STORE_BRANCHES];
const TTL = 10 * 60 * 1000; // a origem atualizava a cada 10 min
const cache = new Map();

async function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await fn();
  cache.set(key, { value, expires: Date.now() + TTL });
  return value;
}

async function token() {
  const body = new URLSearchParams({
    grant_type: "password",
    client_id: process.env.TOTVS_CLIENT_ID ?? "",
    client_secret: process.env.TOTVS_CLIENT_SECRET ?? "",
    username: process.env.TOTVS_USERNAME ?? "",
    password: process.env.TOTVS_PASSWORD ?? "",
  });
  const r = await fetch(`${BASE()}/api/totvsmoda/authorization/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Falha na autenticação TOTVS (${r.status})`);
  return (await r.json()).access_token;
}

// ---------- saldo (balances) ----------
async function balancePage(accessToken, pageNumber, branchCode, stockCode) {
  const r = await fetch(`${BASE()}/api/totvsmoda/product/v2/balances/search`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      filter: { hasStock: true, branchStockCode: branchCode, stockCode, branchInfo: { branchCode, isFinishedProduct: true } },
      option: { balances: [{ branchCode, stockCodeList: [stockCode] }] },
      page: pageNumber,
      pageSize: 1000,
      order: "referenceCode,colorCode,productSize",
    }),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Falha ao consultar estoque TOTVS (${r.status})`);
  return r.json();
}

// scope: "stores" (saldo 1, lojas) | "matrix" (saldo 1, matriz) | "consignment" (saldos 10 e 99, todas)
export function fetchBalances(scope = "stores") {
  return cached(`bal:${scope}`, async () => {
    const branches = scope === "matrix" ? [1] : scope === "consignment" ? ALL_BRANCHES : STORE_BRANCHES;
    const stockCodes = scope === "consignment" ? [10, 99] : [1];
    const accessToken = await token();
    const requests = branches.flatMap((branch) => stockCodes.map((stockCode) => ({ branch, stockCode })));
    const first = await Promise.all(requests.map((q) => balancePage(accessToken, 1, q.branch, q.stockCode)));
    const rest = await Promise.all(
      first.flatMap((res, i) =>
        Array.from({ length: Math.max(0, (res.totalPages ?? 1) - 1) }, (_, p) =>
          balancePage(accessToken, p + 2, requests[i].branch, requests[i].stockCode)
        )
      )
    );
    const merged = new Map();
    for (const item of [...first, ...rest].flatMap((r) => r.items ?? [])) {
      const key = `${item.referenceCode ?? ""}|${item.colorName ?? ""}|${item.sizeName ?? ""}`;
      const cur = merged.get(key) ?? {
        reference: item.referenceCode ?? "",
        name: item.productName ?? "",
        color: item.colorName ?? "",
        size: item.sizeName ?? "",
        stock: 0,
        branches: [],
      };
      for (const b of item.balances ?? []) {
        if (!branches.includes(b.branchCode) || !stockCodes.includes(b.stockCode) || !(Number(b.stock) > 0)) continue;
        const ex = cur.branches.find((x) => x.code === b.branchCode);
        if (ex) ex.stock += Number(b.stock);
        else cur.branches.push({ code: b.branchCode, stock: Number(b.stock) });
        cur.stock += Number(b.stock);
      }
      merged.set(key, cur);
    }
    const products = [...merged.values()].filter((p) => p.stock > 0).sort((a, b) => b.stock - a.stock);
    return { updatedAt: new Date().toISOString(), products };
  });
}

// restringe às filiais permitidas (null = todas)
export function restrictBalances(data, allowed) {
  if (!allowed) return data;
  const set = new Set(allowed.map(Number));
  const products = data.products
    .map((p) => {
      const branches = p.branches.filter((b) => set.has(b.code));
      return { ...p, branches, stock: branches.reduce((s, b) => s + b.stock, 0) };
    })
    .filter((p) => p.stock > 0);
  return { ...data, products };
}

// ---------- condicional / consignado pelas notas ----------
const START_DATE = "2025-01-01T00:00:00";
const CONDITIONAL_MONTHS = 6;
const CONCURRENCY = 10;
// código de operação TOTVS -> +1 remessa / -1 retorno
export const FLOWS = {
  conditional: { 5912: 1, 1913: -1 },
  consignment: { 5917: 1, 1918: -1, 1919: -1 },
};

function startFor(type) {
  if (type !== "conditional") return START_DATE;
  const now = new Date();
  return (
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - CONDITIONAL_MONTHS, now.getUTCDate()))
      .toISOString()
      .slice(0, 10) + "T00:00:00"
  );
}

// a API aceita no máximo 6 meses por consulta: quebra em trimestres
function quarterWindows(startIso, endIso) {
  const windows = [];
  const end = new Date(endIso);
  let cursor = new Date(startIso + "Z");
  while (cursor <= end) {
    const next = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 3, 1));
    const last = new Date(Math.min(next.getTime() - 1000, end.getTime()));
    windows.push({ start: cursor.toISOString().slice(0, 19), end: last.toISOString().slice(0, 19) });
    cursor = next;
  }
  return windows;
}

async function invoicesPage(accessToken, branchCode, operations, start, end, page) {
  const r = await fetch(`${BASE()}/api/totvsmoda/fiscal/v2/invoices/search`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      filter: {
        branchCodeList: [branchCode],
        operationCodeList: operations,
        invoiceStatusList: ["Normal", "Issued"],
        startIssueDate: start,
        endIssueDate: end,
      },
      expand: "items,person",
      order: "issueDate",
      page,
      pageSize: 100,
    }),
    cache: "no-store",
  });
  if (r.status === 403) throw new Error("Usuário de integração sem permissão no módulo Fiscal da TOTVS (403)");
  if (!r.ok) throw new Error(`Loja ${branchCode}: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

async function runLimited(tasks, limit) {
  const results = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, async () => {
      while (next < tasks.length) {
        const i = next++;
        results[i] = await tasks[i]();
      }
    })
  );
  return results;
}

// saldo em aberto por cliente/produto: remessas menos retornos, baixando as mais antigas primeiro (FIFO)
export function computeOpenBalances(invoices, flow, now = Date.now()) {
  const people = new Map();
  const moves = new Map();
  for (const inv of invoices) {
    const sign = flow[Number(inv.operationCode)];
    if (!sign) continue;
    const branchCode = Number(inv.branchCode);
    const personCode = inv.personCode ?? null;
    const clientKey = `${branchCode}|${personCode ?? inv.personName}`;
    if (!people.has(clientKey)) {
      const person = inv.person ?? {};
      people.set(clientKey, {
        branchCode,
        personCode,
        personName: inv.personName ?? person.personName ?? "",
        phone: person.foneNumber ?? "",
        city: [person.city, person.stateAbbreviation].filter(Boolean).join(" / "),
      });
    }
    const date = inv.issueDate ?? inv.invoiceDate ?? "";
    for (const item of inv.items ?? []) {
      const products = item.products?.length
        ? item.products
        : [{ productCode: null, productName: item.name, quantity: item.quantity, unitNetValue: item.unitNetValue }];
      for (const p of products) {
        const productCode = p.productCode ?? null;
        const key = `${clientKey}|${productCode ?? item.code}`;
        const entry = moves.get(key) ?? { clientKey, productCode, sku: item.code ?? "", description: p.productName ?? item.name ?? "", list: [] };
        entry.list.push({ date, sign, quantity: Number(p.quantity ?? 0), unitValue: Number(p.unitNetValue ?? item.unitNetValue ?? 0) });
        moves.set(key, entry);
      }
    }
  }
  const clients = new Map();
  for (const entry of moves.values()) {
    const lots = [];
    for (const m of entry.list.sort((a, b) => a.date.localeCompare(b.date) || b.sign - a.sign)) {
      if (m.sign === 1) {
        lots.push({ date: m.date, quantity: m.quantity, unitValue: m.unitValue });
        continue;
      }
      let remaining = m.quantity;
      while (remaining > 0 && lots.length) {
        const used = Math.min(remaining, lots[0].quantity);
        lots[0].quantity -= used;
        remaining -= used;
        if (lots[0].quantity <= 0) lots.shift();
      }
    }
    const open = lots.reduce((s, l) => s + l.quantity, 0);
    if (open <= 0) continue;
    const value = lots.reduce((s, l) => s + l.quantity * l.unitValue, 0);
    const oldest = lots[0].date;
    const days = oldest ? Math.max(0, Math.floor((now - new Date(oldest).getTime()) / 86400000)) : 0;
    const c = clients.get(entry.clientKey) ?? { ...people.get(entry.clientKey), days: 0, quantity: 0, value: 0, products: [] };
    c.products.push({ code: entry.productCode, sku: entry.sku, description: entry.description, quantity: open, value, days, since: oldest });
    c.quantity += open;
    c.value += value;
    c.days = Math.max(c.days, days);
    clients.set(entry.clientKey, c);
  }
  const list = [...clients.values()].sort((a, b) => b.days - a.days);
  for (const c of list) c.products.sort((a, b) => b.days - a.days);
  return list;
}

// type: "conditional" | "consignment"
export function fetchFiscalBalance(type = "conditional") {
  return cached(`fis:${type}`, async () => {
    const flow = FLOWS[type];
    const operations = Object.keys(flow).map(Number);
    const end = new Date().toISOString().slice(0, 10) + "T23:59:59";
    const start = startFor(type);
    const accessToken = await token();
    const windows = quarterWindows(start, end);
    const firstTasks = ALL_BRANCHES.flatMap((branch) =>
      windows.map((w) => () =>
        invoicesPage(accessToken, branch, operations, w.start, w.end, 1).then((result) => ({ branch, w, result }))
      )
    );
    const firstPages = await runLimited(firstTasks, CONCURRENCY);
    const extraTasks = firstPages.flatMap(({ branch, w, result }) =>
      Array.from({ length: Math.max(0, (result.totalPages ?? 1) - 1) }, (_, i) => () =>
        invoicesPage(accessToken, branch, operations, w.start, w.end, i + 2)
      )
    );
    const extraPages = await runLimited(extraTasks, CONCURRENCY);
    const invoices = [...firstPages.map((p) => p.result), ...extraPages].flatMap((p) => p.items ?? []);
    return {
      type,
      since: start.slice(0, 10),
      updatedAt: new Date().toISOString(),
      invoicesRead: invoices.length,
      clients: computeOpenBalances(invoices, flow),
    };
  });
}

export function restrictClients(data, allowed) {
  if (!allowed) return data;
  const set = new Set(allowed.map(Number));
  return { ...data, clients: data.clients.filter((c) => set.has(Number(c.branchCode))) };
}
