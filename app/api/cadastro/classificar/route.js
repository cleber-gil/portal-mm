import { NextResponse } from "next/server";
import { currentUser, canAccess } from "@/lib/auth";
import { audit } from "@/lib/db";
import { CLASSIFICATION_TYPES, listClassificationValues, setReferenceClassification, invalidate } from "@/lib/totvs";

export const maxDuration = 60;

// POST { references: [{ referenceId, code }], typeCode, valueCode }
export async function POST(request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!canAccess(user, "cadastro", "edit")) {
    return NextResponse.json({ error: "Seu usuário só tem acesso de consulta neste módulo." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const typeCode = Number(body.typeCode);
  const valueCode = String(body.valueCode || "");
  const refs = Array.isArray(body.references) ? body.references.filter((r) => Number.isInteger(r?.referenceId)) : [];

  if (!CLASSIFICATION_TYPES.some((t) => t.code === typeCode)) {
    return NextResponse.json({ error: "Tipo de classificação inválido." }, { status: 400 });
  }
  if (!refs.length || refs.length > 300) {
    return NextResponse.json({ error: "Selecione entre 1 e 300 referências." }, { status: 400 });
  }
  const values = await listClassificationValues();
  const value = values[typeCode]?.find((v) => v.code === valueCode);
  if (!value) return NextResponse.json({ error: "Valor de classificação não encontrado no TOTVS." }, { status: 400 });

  const results = [];
  const CONCURRENCY = 6;
  for (let i = 0; i < refs.length; i += CONCURRENCY) {
    const batch = refs.slice(i, i + CONCURRENCY);
    const done = await Promise.all(
      batch.map(async (r) => ({ ...r, ...(await setReferenceClassification(r.referenceId, typeCode, valueCode)) }))
    );
    results.push(...done);
  }
  invalidate("refs:");

  const ok = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  await audit(user.id, "cadastro", "classificar", {
    typeCode,
    valueCode,
    valueName: value.name,
    references: ok.map((r) => r.code),
    failed: failed.map((r) => ({ code: r.code, error: r.error })),
  });
  return NextResponse.json({ ok: ok.length, failed });
}
