import { NextResponse } from "next/server";
import { currentUser, canAccess } from "@/lib/auth";
import { audit } from "@/lib/db";
import { buildPlan, applyPlan } from "@/lib/familyImport";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST { text, apply } — simula (apply=false) ou grava as famílias no TOTVS
export async function POST(request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!canAccess(user, "cadastro", "edit")) {
    return NextResponse.json({ error: "Seu usuário só tem acesso de consulta no Cadastro de Produtos." }, { status: 403 });
  }
  const { text, apply } = await request.json().catch(() => ({}));
  if (!text || String(text).length > 500_000) return NextResponse.json({ error: "Cole as linhas da planilha." }, { status: 400 });
  try {
    const plan = await buildPlan(text);
    if (!apply) return NextResponse.json(plan);
    const results = await applyPlan(plan);
    const failed = results.filter((r) => !r.ok);
    await audit(user.id, "cadastro", "importar_familias", {
      collections: plan.collections,
      newValues: plan.newValues,
      gravadas: results.filter((r) => r.ok).map((r) => `${r.code}=${r.family}`),
      falhas: failed,
      naoEncontradas: plan.plan.filter((p) => p.status === "nao_encontrada").map((p) => p.code),
    });
    return NextResponse.json({ ...plan, applied: true, ok: results.length - failed.length, failed });
  } catch (e) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 502 });
  }
}
