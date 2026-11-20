import { exportRoute, money } from "@/lib/sales/export";
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

function cell(text) {
  return new TableCell({ children: [new Paragraph(String(text ?? ""))] });
}

function headerCell(text) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: String(text), bold: true })] })],
  });
}

export const GET = exportRoute("exportar_docx", "docx", async ({ report, filters, branchLabel, clientLabel }) => {
  const { start, end, collection } = filters;

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

  return await Packer.toBuffer(doc);
});
