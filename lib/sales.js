// Vendas do TOTVS Moda (portado do totvs-sales-explorer /api/sales)

const BASE = (process.env.TOTVS_BASE_URL || "https://api-gateway.t8671ea.external.saas.totvsmoda.cloudtotvs.com.br").replace(/\/+$/, "");
const ALL_BRANCHES = [1, 2, 5, 6, 7, 9, 10, 11, 12];
const RELEVANT_OPERATIONS = ["Sales", "SaleReturns"];

async function token() {
  const body = new URLSearchParams({
    grant_type: "password",
    client_id: process.env.TOTVS_CLIENT_ID ?? "",
    client_secret: process.env.TOTVS_CLIENT_SECRET ?? "",
    username: process.env.TOTVS_USERNAME ?? "",
    password: process.env.TOTVS_PASSWORD ?? "",
  });
  const response = await fetch(`${BASE}/api/totvsmoda/authorization/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!response.ok) throw new Error(`token_failed: ${JSON.stringify(json)}`);
  return json.access_token;
}

async function fetchPage(accessToken, path, filter, pageNumber, pageSize) {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ filter, page: pageNumber, pageSize }),
  });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!response.ok) throw new Error(`request_failed ${path}: ${JSON.stringify(json)}`);
  return json;
}

async function fetchAll(accessToken, path, filter, pageSize = 1000) {
  const first = await fetchPage(accessToken, path, filter, 1, pageSize);
  const totalPages = first.totalPages ?? 1;
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, totalPages - 1) }, (_, i) => fetchPage(accessToken, path, filter, i + 2, pageSize))
  );
  return [first, ...rest].flatMap((r) => r.items ?? []);
}

// ---------- família (classificação tipo 104 do TOTVS) ----------
const FAMILY_TYPE_CODE = 104;
const NO_FAMILY = "Sem família";
const FAMILY_CACHE_TTL_MS = 60 * 60 * 1000; // 1h
const familyCache = new Map(); // productCode -> { family, familyCode, expires }

async function fetchProductsPage(accessToken, codes) {
  const response = await fetch(`${BASE}/api/totvsmoda/product/v2/products/search`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      filter: { productCodeList: codes },
      option: { branchInfoCode: 1 },
      expand: "classifications",
      page: 1,
      pageSize: codes.length,
    }),
  });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!response.ok) throw new Error(`products_failed: ${JSON.stringify(json).slice(0, 300)}`);
  return json.items ?? [];
}

// devolve Map productCode -> { family, familyCode }; se o TOTVS falhar, não derruba as vendas
async function fetchFamilies(accessToken, productCodes) {
  const now = Date.now();
  const result = new Map();
  const missing = [];
  for (const code of productCodes) {
    const hit = familyCache.get(code);
    if (hit && hit.expires > now) result.set(code, hit);
    else missing.push(code);
  }

  const CHUNK = 200;
  const chunks = [];
  for (let i = 0; i < missing.length; i += CHUNK) chunks.push(missing.slice(i, i + CHUNK));

  let error = null;
  const CONCURRENCY = 4;
  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const batch = chunks.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(batch.map((c) => fetchProductsPage(accessToken, c)));
    settled.forEach((s, idx) => {
      if (s.status === "rejected") {
        error = s.reason instanceof Error ? s.reason.message : String(s.reason);
        return;
      }
      const found = new Set();
      for (const item of s.value) {
        const cls = (item.classifications ?? []).find((c) => Number(c.typeCode) === FAMILY_TYPE_CODE);
        const entry = {
          family: cls?.name?.trim() || NO_FAMILY,
          familyCode: cls?.code ?? null,
          expires: now + FAMILY_CACHE_TTL_MS,
        };
        familyCache.set(item.productCode, entry);
        result.set(item.productCode, entry);
        found.add(item.productCode);
      }
      // produto não retornado pelo TOTVS: marca sem família (cache curto pra tentar de novo depois)
      for (const code of batch[idx]) {
        if (!found.has(code)) result.set(code, { family: NO_FAMILY, familyCode: null });
      }
    });
  }
  return { families: result, error };
}

function groupBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    const sign = row.type === "devolucao" ? -1 : 1;
    const current = map.get(key) ?? { key, quantity: 0, grossValue: 0, netValue: 0 };
    current.quantity += sign * row.quantity;
    current.grossValue += sign * row.grossValue;
    current.netValue += sign * row.netValue;
    map.set(key, current);
  }
  return [...map.values()].sort((a, b) => b.netValue - a.netValue);
}


// busca as vendas do período no TOTVS (Analytics V2) e devolve as linhas normalizadas
export async function fetchSales(start, end) {
    const filter = { startMovementDate: start, endMovementDate: end, branchCodeList: ALL_BRANCHES };

  const accessToken = await token();

  const [movements, products, persons, branches] = await Promise.all([
    fetchAll(accessToken, "/api/totvsmoda/analytics/v2/fiscal-movement/search", filter),
    fetchAll(accessToken, "/api/totvsmoda/analytics/v2/product-fiscal-movement/search", filter),
    fetchAll(accessToken, "/api/totvsmoda/analytics/v2/person-fiscal-movement/search", filter),
    fetchAll(accessToken, "/api/totvsmoda/analytics/v2/branch-fiscal-movement/search", filter),
  ]);

  const productMap = new Map(products.map((p) => [p.productCode, p]));
  const personMap = new Map(persons.map((p) => [p.code, p]));
  const branchMap = new Map(branches.map((b) => [b.code, b]));

  const relevant = movements.filter((m) => RELEVANT_OPERATIONS.includes(m.operationModel));
  const productCodes = [...new Set(relevant.map((m) => m.productCode).filter((c) => c != null))];
  const { families, error: familyError } = await fetchFamilies(accessToken, productCodes);

  const sales = relevant
    .map((m) => {
      const fam = families.get(m.productCode) ?? { family: NO_FAMILY, familyCode: null };
      const product = productMap.get(m.productCode) ?? {};
      const person = personMap.get(m.personCode) ?? {};
      const branch = branchMap.get(m.branchCode) ?? {};
      return {
        date: m.movementDate,
        type: m.operationModel === "Sales" ? "venda" : "devolucao",
        branchCode: m.branchCode,
        branchName: branch.fantasyName ?? branch.name ?? String(m.branchCode),
        branchDoc: branch.cpfCnpj ?? branch.cnpj ?? branch.document ?? branch.branchCnpj ?? null,
        clientCode: m.personCode,
        clientName: person.name ?? String(m.personCode),
        clientDoc: person.cpfCnpj ?? null,
        productCode: m.productCode,
        productName: product.name ?? String(m.productCode),
        reference: product.referenceCode ?? null,
        referenceName: product.referenceName ?? null,
        color: product.colorName ?? null,
        size: product.sizeName ?? null,
        family: fam.family,
        familyCode: fam.familyCode,
        sellerCode: m.sellerCode,
        quantity: Number(m.quantity) || 0,
        grossValue: Number(m.grossValue) || 0,
        discountValue: Number(m.discountValue) || 0,
        netValue: Number(m.netValue) || 0,
      };
    });

  return { sales, familyError };
}
