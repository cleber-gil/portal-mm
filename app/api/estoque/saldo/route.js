import { NextResponse } from "next/server";
import { currentUser, canAccess } from "@/lib/core/auth";
import { visibleBranches } from "@/lib/core/access";
import { fetchBalances, restrictBalances } from "@/lib/totvs/stock";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET ?scope=stores|matrix|consignment — saldo filtrado pelas filiais do usuário
export async function GET(request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!canAccess(user, "estoque", "view")) return NextResponse.json({ error: "sem acesso ao Estoque" }, { status: 403 });
  const allowed = visibleBranches(user);
  const scopeParam = new URL(request.url).searchParams.get("scope");
  const scope = ["stores", "matrix", "consignment"].includes(scopeParam) ? scopeParam : "stores";
  if (scope === "matrix" && allowed && !allowed.includes(1)) {
    return NextResponse.json({ error: "Seu usuário não tem acesso à Matriz." }, { status: 403 });
  }
  try {
    return NextResponse.json(restrictBalances(await fetchBalances(scope), allowed));
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erro ao consultar a TOTVS" }, { status: 502 });
  }
}
