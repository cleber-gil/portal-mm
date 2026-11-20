import { NextResponse } from "next/server";
import { getReport, defaultDates } from "@/lib/salesReport";
import { currentUser, canAccess } from "@/lib/auth";
import { visibleBranches } from "@/lib/access";
import { audit } from "@/lib/db";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  TextRun,
  WidthType,
} from "docx";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function money(v) {
  return (Number(v) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });
}

function cell(text) {
  return new TableCell({ children: [new Paragraph(String(text ?? ""))] });
}

function headerCell(text) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: String(text), bold: true })] })],
  });
}

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

    await audit(user.id, "vendas", "exportar_docx", { start, end, branch, collection, client, family, scope });
    const report = await getReport({ start, end, branch, collection, client, family, scope, allowedBranches });
    const branchLabel = branch
      ? report.branchOptions.find((b) => b.code === branch)?.name || branch
      : "Todas";
    const clientLabel = client
      ? report.clientOptions.find((c) => c.code === client)?.name || client
      : "Todos";

    const branchRows = [...report.byBranch].sort((a, b) => b.net - a.net);
    const productRows = [...report.byProduct].sort((a, b) => b.quantity - a.quantity).slice(0, 40);

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ text: "Painel de Vendas — Martha Medeiros", heading: HeadingLevel.HEADING_1 }),
            new Paragraph(`Período: ${start} a ${end}`),
            new Paragraph(`Filial: ${branchLabel}`),
            new Paragraph(`Coleção: ${collection || "Todas"}`),
            new Paragraph(`Cliente: ${clientLabel}`),
            new Paragraph(" "),
            new Paragraph({ text: "Totais", heading: HeadingLevel.HEADING_2 }),
            new Paragraph(`Peças vendidas: ${report.totals.quantity.toLocaleString("pt-BR")}`),
            new Paragraph(`Valor bruto: ${money(report.totals.gross)}`),
            new Paragraph(`Valor líquido: ${money(report.totals.net)}`),
            new Paragraph(`Registros: ${report.totals.count.toLocaleString("pt-BR")}`),
            new Paragraph(" "),
            new Paragraph({ text: "Vendas por filial", heading: HeadingLevel.HEADING_2 }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [headerCell("Filial"), headerCell("Qtde"), headerCell("Bruto"), headerCell("Líquido")],
                }),
                ...branchRows.map(
                  (b) =>
                    new TableRow({
                      children: [cell(b.name), cell(b.quantity), cell(money(b.gross)), cell(money(b.net))],
                    })
                ),
              ],
            }),
            new Paragraph(" "),
            new Paragraph({ text: "Top produtos", heading: HeadingLevel.HEADING_2 }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    headerCell("Referência"),
                    headerCell("Coleção"),
                    headerCell("Descrição"),
                    headerCell("Cor"),
                    headerCell("Tam."),
                    headerCell("Qtde"),
                    headerCell("Líquido"),
                  ],
                }),
                ...productRows.map(
                  (p) =>
                    new TableRow({
                      children: [
                        cell(p.reference),
                        cell(p.collection),
                        cell(p.name),
                        cell(p.color),
                        cell(p.size),
                        cell(p.quantity),
                        cell(money(p.net)),
                      ],
                    })
                ),
              ],
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="vendas_${start}_a_${end}.docx"`,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
