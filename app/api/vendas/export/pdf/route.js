import { NextResponse } from "next/server";
import { getReport, defaultDates } from "@/lib/sales/report";
import { currentUser, canAccess } from "@/lib/core/auth";
import { visibleBranches } from "@/lib/core/access";
import { audit } from "@/lib/core/db";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 40;
const INK = rgb(0.04, 0.04, 0.04);
const MUTED = rgb(0.32, 0.32, 0.31);

function money(v) {
  return (Number(v) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });
}

class PdfWriter {
  constructor(doc, font, fontBold) {
    this.doc = doc;
    this.font = font;
    this.fontBold = fontBold;
    this.page = null;
    this.y = 0;
    this.addPage();
  }

  addPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
  }

  ensureSpace(needed) {
    if (this.y - needed < MARGIN) this.addPage();
  }

  line(text, { size = 10, bold = false, color = INK, gap = 5, x = MARGIN } = {}) {
    this.ensureSpace(size + gap);
    this.page.drawText(String(text ?? ""), {
      x,
      y: this.y,
      size,
      font: bold ? this.fontBold : this.font,
      color,
    });
    this.y -= size + gap;
  }

  space(amount = 8) {
    this.y -= amount;
  }
}

function buildPdf(report, branchLabel, clientLabel) {
  return async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const w = new PdfWriter(doc, font, fontBold);

    w.line("Painel de Vendas — Martha Medeiros", { size: 16, bold: true, gap: 6 });
    w.line(
      `Período: ${report.period.start} a ${report.period.end} · Filial: ${branchLabel} · Coleção: ${
        report.filters.collection || "Todas"
      } · Cliente: ${clientLabel}`,
      { size: 9, color: MUTED, gap: 14 }
    );

    w.line("Totais", { size: 12, bold: true, gap: 8 });
    w.line(`Peças vendidas: ${report.totals.quantity.toLocaleString("pt-BR")}`, { size: 10 });
    w.line(`Valor bruto: ${money(report.totals.gross)}`, { size: 10 });
    w.line(`Valor líquido: ${money(report.totals.net)}`, { size: 10 });
    w.line(`Registros: ${report.totals.count.toLocaleString("pt-BR")}`, { size: 10, gap: 16 });

    w.line("Vendas por filial", { size: 12, bold: true, gap: 8 });
    [...report.byBranch]
      .sort((a, b) => b.net - a.net)
      .forEach((b) => {
        w.line(
          `${b.name} — ${b.quantity} pçs — Bruto ${money(b.gross)} — Líquido ${money(b.net)}`,
          { size: 9, gap: 4 }
        );
      });
    w.space(12);

    w.line("Top produtos por quantidade", { size: 12, bold: true, gap: 8 });
    [...report.byProduct]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 30)
      .forEach((p) => {
        w.line(
          `${p.reference || "—"} (${p.collection}) — ${p.name} — ${p.color}/${p.size} — Qtde ${
            p.quantity
          } — Líquido ${money(p.net)}`,
          { size: 9, gap: 4 }
        );
      });
    w.space(12);

    w.line("Top clientes por valor líquido", { size: 12, bold: true, gap: 8 });
    [...report.byClient]
      .sort((a, b) => b.net - a.net)
      .slice(0, 20)
      .forEach((c) => {
        w.line(`${c.name} — ${c.quantity} pçs — Líquido ${money(c.net)}`, { size: 9, gap: 4 });
      });

    return doc.save();
  };
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

    await audit(user.id, "vendas", "exportar_pdf", { start, end, branch, collection, client, family, scope });
    const report = await getReport({ start, end, branch, collection, client, family, scope, allowedBranches });
    const branchLabel = branch
      ? report.branchOptions.find((b) => b.code === branch)?.name || branch
      : "Todas";
    const clientLabel = client
      ? report.clientOptions.find((c) => c.code === client)?.name || client
      : "Todos";

    const bytes = await buildPdf(report, branchLabel, clientLabel)();

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="vendas_${start}_a_${end}.pdf"`,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
