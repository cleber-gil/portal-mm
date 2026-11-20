import { NextResponse } from "next/server";
import { currentUser, canAccess } from "@/lib/core/auth";
import { visibleBranches } from "@/lib/core/access";
import { fetchFiscalBalance, restrictClients } from "@/lib/totvs/stock";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET ?type=conditional|consignment — saldo em aberto pelas notas, filtrado pelas filiais do usuário
export async function GET(request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!canAccess(user, "estoque", "view")) return NextResponse.json({ error: "sem acesso ao Estoque" }, { status: 403 });
  const type = new URL(request.url).searchParams.get("type") === "consignment" ? "consignment" : "conditional";
  try {
    return NextResponse.json(restrictClients(await fetchFiscalBalance(type), visibleBranches(user)));
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erro ao consultar a TOTVS" }, { status: 502 });
  }
}
