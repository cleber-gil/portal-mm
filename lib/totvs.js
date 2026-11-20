// Produtos e classificações no TOTVS Moda (Product V2)
import { totvsCall as call } from "./totvs/client";

export const CLASSIFICATION_TYPES = [
  { code: 100, name: "Linha" },
  { code: 101, name: "Grupo" },
  { code: 102, name: "Tipo" },
  { code: 103, name: "Coleção" },
  { code: 104, name: "Família" },
];
const TYPE_CODES = CLASSIFICATION_TYPES.map((t) => t.code);

function totvsError(res, what) {
  const msgs = Array.isArray(res.json) ? res.json.map((e) => e.message).join("; ") : JSON.stringify(res.json)?.slice(0, 300);
  return new Error(`${what} (HTTP ${res.status}): ${msgs}`);
}

// ---------- cache simples em memória ----------
const cache = new Map();
async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await fn();
  cache.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}
export function invalidate(prefix) {
  for (const k of cache.keys()) if (k.startsWith(prefix)) cache.delete(k);
}

// ---------- classificações ----------
// { [typeCode]: [{ code, name }] }
export async function listClassificationValues() {
  return cached("cls", 5 * 60 * 1000, async () => {
    const out = Object.fromEntries(TYPE_CODES.map((c) => [c, []]));
    let page = 1;
    for (;;) {
      const qs = TYPE_CODES.map((c) => `TypeCodeList=${c}`).join("&");
      const res = await call("GET", `/api/totvsmoda/product/v2/classifications?${qs}&Page=${page}&PageSize=1000`);
      if (!res.ok) throw totvsError(res, "Erro ao consultar classificações");
      for (const i of res.json?.items ?? []) {
        const t = Number(i.typeCode);
        if (out[t]) out[t].push({ code: String(i.code), name: String(i.name || "").trim() });
      }
      if (!res.json?.hasNext) break;
      page += 1;
    }
    for (const t of TYPE_CODES) out[t].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return out;
  });
}

// coleções (tipo 103) da mais nova para a mais antiga: W27, S27, W26, S26...
export function sortCollections(values) {
  const key = (c) => {
    const m = /^([A-Z]+)(\d{2})/.exec(c.code);
    return m ? Number(m[2]) * 10 + (m[1] === "W" ? 1 : 0) : -1;
  };
  return [...values].sort((a, b) => key(b) - key(a) || a.code.localeCompare(b.code));
}

export async function upsertClassificationValue(typeCode, code, description) {
  const res = await call("POST", "/api/totvsmoda/product/v2/classifications", {
    typeCode,
    classifications: [{ code, description }],
  });
  if (!res.ok) throw totvsError(res, "Erro ao gravar classificação");
  invalidate("cls");
  invalidate("refs:");
}

// ---------- referências ----------
// agrega os SKUs de uma coleção por referência (grupo)
export function aggregateReferences(items) {
  const refs = new Map();
  for (const p of items) {
    const id = p.referenceId;
    if (id == null) continue;
    let r = refs.get(id);
    if (!r) {
      r = {
        referenceId: id,
        code: p.ReferenceCode ?? p.referenceCode ?? "",
        name: p.referenceName ?? "",
        colors: new Set(),
        sizes: new Set(),
        skus: 0,
        active: false,
        classifications: {},
        mixed: [],
      };
      refs.set(id, r);
    }
    r.skus += 1;
    if (p.colorName) r.colors.add(p.colorName);
    if (p.size) r.sizes.add(p.size);
    if (p.isActive) r.active = true;
    for (const c of p.classifications ?? []) {
      const t = Number(c.typeCode);
      if (!TYPE_CODES.includes(t)) continue;
      const v = { code: String(c.code), name: String(c.name || "").trim() };
      const prev = r.classifications[t];
      if (!prev) r.classifications[t] = v;
      else if (prev.code !== v.code && !r.mixed.includes(t)) r.mixed.push(t);
    }
  }
  return [...refs.values()]
    .map((r) => ({ ...r, colors: [...r.colors].sort(), sizes: [...r.sizes] }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

export async function listReferencesByCollection(collectionCode) {
  return cached(`refs:${collectionCode}`, 2 * 60 * 1000, async () => {
    const items = [];
    let page = 1;
    for (;;) {
      const res = await call("POST", "/api/totvsmoda/product/v2/products/search", {
        filter: { classifications: [{ type: 103, codeList: [collectionCode] }] },
        option: { branchInfoCode: 1 },
        expand: "classifications",
        page,
        pageSize: 1000,
      });
      if (!res.ok) throw totvsError(res, "Erro ao consultar produtos");
      items.push(...(res.json?.items ?? []));
      if (!res.json?.hasNext || page >= 20) break;
      page += 1;
    }
    return aggregateReferences(items);
  });
}

// grava (ou troca) uma classificação no grupo/referência
export async function setReferenceClassification(referenceId, typeCode, code) {
  const payload = { products: [{ referenceId, classifications: [{ typeCode, code }] }] };
  let res = await call("POST", "/api/totvsmoda/product/v2/classification-relationship/create", payload);
  if (res.ok) return { ok: true, action: "create" };
  const upd = await call("POST", "/api/totvsmoda/product/v2/classification-relationship/update", payload);
  if (upd.ok) return { ok: true, action: "update" };
  const msg = (r) => (Array.isArray(r.json) ? r.json.map((e) => e.message).join("; ") : JSON.stringify(r.json)?.slice(0, 200));
  return { ok: false, error: msg(upd) || msg(res) };
}
