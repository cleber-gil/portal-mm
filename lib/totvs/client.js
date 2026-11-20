// Cliente único da API TOTVS Moda V2 (só no servidor).
// Token em cache por instância; 401 renova o token e repete uma vez.
// Leituras (GET e .../search) repetem em 429/5xx; gravações nunca repetem,
// porque a TOTVS pode ter gravado e a repetição duplicaria.

const BASE = () =>
  (process.env.TOTVS_BASE_URL || "https://api-gateway.t8671ea.external.saas.totvsmoda.cloudtotvs.com.br").replace(/\/+$/, "");

const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const READ_RETRIES = 2;

let tokenCache = null; // { token, expires }
let tokenPending = null; // evita vários logins simultâneos na mesma instância

async function fetchToken() {
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
  const t = await r.text();
  if (!r.ok) throw new Error(`Falha ao autenticar no TOTVS (HTTP ${r.status}): ${t.slice(0, 300)}`);
  const json = JSON.parse(t);
  const ttl = Math.max(60, (Number(json.expires_in) || 3600) - 120) * 1000;
  tokenCache = { token: json.access_token, expires: Date.now() + ttl };
  return tokenCache.token;
}

export async function totvsToken() {
  if (tokenCache && tokenCache.expires > Date.now()) return tokenCache.token;
  tokenPending ||= fetchToken().finally(() => {
    tokenPending = null;
  });
  return tokenPending;
}

const isRead = (method, path) => method === "GET" || /\/search(\?|$)/.test(path);
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));

// chamada crua: devolve { ok, status, json, text } sem lançar erro de HTTP
export async function totvsCall(method, path, payload) {
  const retries = isRead(method, path) ? READ_RETRIES : 0;
  let renewed = false;
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(`${BASE()}${path}`, {
      method,
      headers: { Authorization: `Bearer ${await totvsToken()}`, "Content-Type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined,
      cache: "no-store",
    });
    if (r.status === 401 && !renewed) {
      tokenCache = null;
      renewed = true;
      attempt--;
      continue;
    }
    if (RETRY_STATUS.has(r.status) && attempt < retries) {
      await wait(1000 * (attempt + 1));
      continue;
    }
    const text = await r.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text.slice(0, 500) };
    }
    return { ok: r.ok, status: r.status, json, text };
  }
}

// POST de busca paginada (Analytics/Product/Fiscal V2): lança erro se a TOTVS recusar
export async function totvsSearch(path, body, errorPrefix = `Erro em ${path}`) {
  const res = await totvsCall("POST", path, body);
  if (!res.ok) throw new Error(`${errorPrefix} (HTTP ${res.status}): ${res.text.slice(0, 300)}`);
  return res.json ?? {};
}

// busca todas as páginas: lê a primeira, depois as demais em paralelo
export async function totvsSearchAll(path, filter, { pageSize = 1000, extra = {}, errorPrefix } = {}) {
  const page = (n) => totvsSearch(path, { filter, ...extra, page: n, pageSize }, errorPrefix);
  const first = await page(1);
  const rest = await Promise.all(Array.from({ length: Math.max(0, (first.totalPages ?? 1) - 1) }, (_, i) => page(i + 2)));
  return [first, ...rest].flatMap((r) => r.items ?? []);
}
