// Importação de famílias (classificação 104) a partir de colunas coladas do Excel:
// CÓDIGO <tab> PEÇA <tab> FAMÍLIA  (cabeçalho opcional)
import {
  listClassificationValues,
  listReferencesByCollection,
  setReferenceClassification,
  upsertClassificationValue,
  invalidate,
} from "../totvs/products";

export const FAMILY_TYPE = 104;

// maiúsculas, sem acento, espaços normalizados (padrão do cadastro: "PAETE SOLEIL")
export function cleanName(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}
const normCode = (s) => String(s || "").replace(/\s+/g, "").toUpperCase();

export function parseSheet(text) {
  const rows = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cols = line.split("\t").map((c) => c.trim());
    if (cols.length < 2) continue;
    const code = normCode(cols[0]);
    const family = cleanName(cols.length >= 3 ? cols[2] : cols[1]);
    const piece = cols.length >= 3 ? cols[1].replace(/\s+/g, " ") : "";
    if (!code || !family || /^C[OÓ]DIGO/i.test(cols[0])) continue; // cabeçalho
    rows.push({ code, piece, family });
  }
  const count = new Map();
  for (const r of rows) count.set(r.code, (count.get(r.code) || 0) + 1);
  const duplicates = [...count].filter(([, n]) => n > 1).map(([c]) => c);
  return { rows: rows.filter((r) => !duplicates.includes(r.code)), duplicates, total: rows.length };
}

export async function buildPlan(text) {
  const { rows, duplicates, total } = parseSheet(text);
  const values = await listClassificationValues();
  const existing = values[FAMILY_TYPE] || [];
  const codeByName = new Map(existing.map((v) => [cleanName(v.name), v.code]));
  const width = existing.reduce((m, v) => Math.max(m, v.code.length), 2);
  let next = existing.reduce((m, v) => Math.max(m, parseInt(v.code, 10) || 0), 0) + 1;
  const newValues = [];
  for (const name of [...new Set(rows.map((r) => r.family))].sort()) {
    if (!codeByName.has(name)) {
      const code = String(next++).padStart(width, "0");
      codeByName.set(name, code);
      newValues.push({ code, name });
    }
  }

  // referências: busca pela coleção (prefixo do código, ex.: W27)
  const collections = [...new Set(rows.map((r) => (/^([A-Z]{1,3}\d{2})/.exec(r.code) || [])[1]).filter(Boolean))];
  const refByCode = new Map();
  for (const c of collections) {
    for (const ref of await listReferencesByCollection(c)) refByCode.set(normCode(ref.code), ref);
  }

  const plan = rows.map((r) => {
    const ref = refByCode.get(r.code);
    const current = ref?.classifications?.[FAMILY_TYPE] || null;
    const familyCode = codeByName.get(r.family);
    return {
      ...r,
      familyCode,
      referenceId: ref?.referenceId ?? null,
      totvsCode: ref?.code ?? null,
      current: current ? current.name : null,
      status: !ref ? "nao_encontrada" : current?.code === familyCode ? "ja_ok" : current ? "trocar" : "gravar",
    };
  });

  return { total, duplicates, collections, newValues, existing, plan };
}

export async function applyPlan(planData) {
  const results = [];
  for (const v of planData.newValues) {
    await upsertClassificationValue(FAMILY_TYPE, v.code, v.name);
  }
  const todo = planData.plan.filter((p) => p.status === "gravar" || p.status === "trocar");
  const CONCURRENCY = 6;
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    const batch = todo.slice(i, i + CONCURRENCY);
    results.push(
      ...(await Promise.all(
        batch.map(async (p) => ({ code: p.code, family: p.family, ...(await setReferenceClassification(p.referenceId, FAMILY_TYPE, p.familyCode)) }))
      ))
    );
  }
  invalidate("refs:");
  invalidate("cls");
  return results;
}
