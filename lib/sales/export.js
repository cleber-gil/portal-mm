// Base comum das exportações do Painel de Vendas (Excel, PDF, Word):
// sessão + permissão, filtros da URL, filiais do usuário, auditoria e resposta com o arquivo.
import { NextResponse } from "next/server";
import { getReport, defaultDates } from "./report";
import { currentUser, canAccess } from "../core/auth";
import { visibleBranches } from "../core/access";
import { audit } from "../core/db";

export const CONTENT_TYPES = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export function money(v) {
  return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
}

// build({ report, filters, branchLabel, clientLabel }) devolve os bytes do arquivo
export function exportRoute(action, ext, build) {
  return async function GET(request) {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
    if (!canAccess(user, "vendas", "view")) return NextResponse.json({ error: "sem acesso ao Painel de Vendas" }, { status: 403 });
    const allowedBranches = visibleBranches(user);
    try {
      const { searchParams } = new URL(request.url);
      const defaults = defaultDates();
      const filters = {
        start: searchParams.get("start") || defaults.start,
        end: searchParams.get("end") || defaults.end,
        branch: searchParams.get("branch") || "",
        collection: searchParams.get("collection") || "",
        client: searchParams.get("client") || "",
        family: searchParams.get("family") || "",
        scope: searchParams.get("scope") || "",
      };
      await audit(user.id, "vendas", action, filters);
      const report = await getReport({ ...filters, allowedBranches });
      const branchLabel = filters.branch
        ? report.branchOptions.find((b) => b.code === filters.branch)?.name || filters.branch
        : "Todas";
      const clientLabel = filters.client
        ? report.clientOptions.find((c) => c.code === filters.client)?.name || filters.client
        : "Todos";

      const body = await build({ report, filters, branchLabel, clientLabel });
      return new Response(body, {
        status: 200,
        headers: {
          "Content-Type": CONTENT_TYPES[ext],
          "Content-Disposition": `attachment; filename="vendas_${filters.start}_a_${filters.end}.${ext}"`,
        },
      });
    } catch (e) {
      return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
    }
  };
}
