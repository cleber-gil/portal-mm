import { NextResponse } from "next/server";
import { getReport, defaultDates } from "@/lib/sales/report";
import { currentUser, canAccess } from "@/lib/core/auth";
import { visibleBranches } from "@/lib/core/access";
import { audit } from "@/lib/core/db";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!canAccess(user, "vendas", "view")) return NextResponse.json({ error: "sem acesso ao Painel de Vendas" }, { status: 403 });
  const allowedBranches = visibleBranches(user);
  try {
    const { searchParams } = new URL(request.url);
    const defaults = defaultDates();
    const start = searchParams.get("start") || defaults.start;
    const end = searchParams.get("end") || defaults.end;
    const branch = searchParams.get("branch") || "";
    const collection = searchParams.get("collection") || "";
    const client = searchParams.get("client") || "";
    const family = searchParams.get("family") || "";
    const scope = searchParams.get("scope") || "";

    await audit(user.id, "vendas", "exportar_excel", { start, end, branch, collection, client, family, scope });
    const report = await getReport({ start, end, branch, collection, client, family, scope, allowedBranches });

    const wb = new ExcelJS.Workbook();
    wb.creator = "Painel de Vendas — Martha Medeiros";
    wb.created = new Date();

    const sheetVendas = wb.addWorksheet("Vendas");
    sheetVendas.columns = [
      { header: "Filial", key: "branchName", width: 28 },
      { header: "Cliente", key: "personName", width: 32 },
      { header: "CPF/CNPJ", key: "document", width: 20 },
      { header: "Entre empresas do grupo", key: "grupo", width: 12 },
      { header: "Referência", key: "referenceCode", width: 14 },
      { header: "Coleção", key: "collection", width: 10 },
      { header: "Família", key: "family", width: 18 },
      { header: "Descrição", key: "description", width: 28 },
      { header: "Cor", key: "color", width: 14 },
      { header: "Tam.", key: "size", width: 8 },
      { header: "Vendedor", key: "seller", width: 16 },
      { header: "Qtde", key: "quantity", width: 10 },
      { header: "Bruto", key: "gross", width: 14 },
      { header: "Líquido", key: "net", width: 14 },
    ];
    sheetVendas.getRow(1).font = { bold: true };
    report.sales.forEach((s) => sheetVendas.addRow({ ...s, grupo: s.intercompany ? "Sim" : "" }));
    sheetVendas.getColumn("gross").numFmt = '"R$" #,##0.00';
    sheetVendas.getColumn("net").numFmt = '"R$" #,##0.00';

    const sheetBranch = wb.addWorksheet("Por Filial");
    sheetBranch.columns = [
      { header: "Filial", key: "name", width: 32 },
      { header: "Qtde", key: "quantity", width: 10 },
      { header: "Bruto", key: "gross", width: 16 },
      { header: "Líquido", key: "net", width: 16 },
    ];
    sheetBranch.getRow(1).font = { bold: true };
    [...report.byBranch].sort((a, b) => b.net - a.net).forEach((b) => sheetBranch.addRow(b));
    sheetBranch.getColumn("gross").numFmt = '"R$" #,##0.00';
    sheetBranch.getColumn("net").numFmt = '"R$" #,##0.00';

    const sheetFamily = wb.addWorksheet("Por Família");
    sheetFamily.columns = [
      { header: "Família", key: "name", width: 28 },
      { header: "Qtde", key: "quantity", width: 10 },
      { header: "Bruto", key: "gross", width: 16 },
      { header: "Líquido", key: "net", width: 16 },
    ];
    sheetFamily.getRow(1).font = { bold: true };
    [...report.byFamily].sort((a, b) => b.net - a.net).forEach((f) => sheetFamily.addRow(f));
    sheetFamily.getColumn("gross").numFmt = '"R$" #,##0.00';
    sheetFamily.getColumn("net").numFmt = '"R$" #,##0.00';

    const sheetProduct = wb.addWorksheet("Por Produto");
    sheetProduct.columns = [
      { header: "Referência", key: "reference", width: 14 },
      { header: "Coleção", key: "collection", width: 10 },
      { header: "Família", key: "family", width: 18 },
      { header: "Descrição", key: "name", width: 28 },
      { header: "Cor", key: "color", width: 14 },
      { header: "Tam.", key: "size", width: 8 },
      { header: "Qtde vendida", key: "quantity", width: 12 },
      { header: "Líquido", key: "net", width: 16 },
      { header: "Estoque atual", key: "currentStock", width: 14 },
      { header: "Giro (período)", key: "turnoverRatio", width: 14 },
      { header: "Cobertura (dias)", key: "daysOfCoverage", width: 16 },
    ];
    sheetProduct.getRow(1).font = { bold: true };
    [...report.byProduct]
      .sort((a, b) => b.quantity - a.quantity)
      .forEach((p) => {
        sheetProduct.addRow({
          ...p,
          turnoverRatio: p.zeroStockButSelling
            ? "sem estoque"
            : p.turnoverRatio == null
            ? ""
            : Number(p.turnoverRatio.toFixed(2)),
          daysOfCoverage:
            p.daysOfCoverage === Infinity
              ? "parado"
              : p.daysOfCoverage == null
              ? ""
              : Math.round(p.daysOfCoverage),
        });
      });
    sheetProduct.getColumn("net").numFmt = '"R$" #,##0.00';
    if (report.stockError) {
      sheetProduct.addRow([]);
      sheetProduct.addRow([`Giro de estoque indisponível: ${report.stockError}`]);
    }

    const buffer = await wb.xlsx.writeBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="vendas_${start}_a_${end}.xlsx"`,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
