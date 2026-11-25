import { NextResponse } from "next/server";
import { currentUser, canAccess } from "@/lib/core/auth";
import { visibleBranches } from "@/lib/core/access";
import { fetchOutside, restrictOutside } from "@/lib/totvs/stock";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET — peças em condicional/consignado por SKU (com quem estão), filtrado pelas filiais do usuário
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!canAccess(user, "estoque", "view")) return NextResponse.json({ error: "sem acesso ao Estoque" }, { status: 403 });
  try {
    return NextResponse.json(restrictOutside(await fetchOutside(), visibleBranches(user)));
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erro ao consultar a TOTVS" }, { status: 502 });
  }
}
