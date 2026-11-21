// Dados da tela inicial: mês corrente de vendas e retrato do estoque, já limitados às filiais do usuário
import { cache } from "react";
import { getReport } from "../sales/report";
import { fetchBalances, restrictBalances, fetchFiscalBalance, restrictClients } from "../totvs/stock";
import { branchName } from "../config/branches";
import { getOrRefresh } from "../core/cache";

const TZ = "America/Sao_Paulo";

export function monthInfo(now = new Date()) {
  const [y, m, d] = now.toLocaleDateString("en-CA", { timeZone: TZ }).split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const pad = (n) => String(n).padStart(2, "0");
  return {
    start: `${y}-${pad(m)}-01`,
    end: `${y}-${pad(m)}-${pad(d)}`,
    today: d,
    daysInMonth,
    label: new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" }),
    dayKey: (n) => `${y}-${pad(m)}-${pad(n)}`,
    prev: (() => {
      const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
      const pdays = new Date(Date.UTC(py, pm, 0)).getUTCDate();
      return {
        start: `${py}-${pad(pm)}-01`,
        end: `${py}-${pad(pm)}-${pad(pdays)}`,
        label: new Date(Date.UTC(py, pm - 1, 15)).toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" }),
      };
    })(),
  };
}

// mês anterior fechado: não muda mais, fica guardado no banco (renova a cada 12 h)
async function prevMonth(mi, allowedKey) {
  const allowed = allowedKey ? allowedKey.split(",").map(Number) : null;
  return getOrRefresh(`home:prev:${mi.prev.start}:${allowedKey || "all"}`, 12 * 60 * 60 * 1000, async () => {
    const r = await getReport({ start: mi.prev.start, end: mi.prev.end, scope: "clientes", allowedBranches: allowed });
    const byDay = {};
    for (const s of r.sales) {
      const d = Number(String(s.date).slice(8, 10));
      byDay[d] = (byDay[d] || 0) + (s.isReturn ? -1 : 1) * s.net;
    }
    return { total: r.totals.net, byDay };
  });
}

// uma busca por request, mesmo com vários cartões pedindo
export const getMonthSales = cache((allowedKey) => monthSales(allowedKey).catch((e) => ({ error: e.message || String(e) })));

async function monthSales(allowedKey) {
  const allowed = allowedKey ? allowedKey.split(",").map(Number) : null;
  const mi = monthInfo();
  const [report, prev] = await Promise.all([
    getReport({ start: mi.start, end: mi.end, scope: "clientes", allowedBranches: allowed }),
    prevMonth(mi, allowedKey).catch(() => null),
  ]);

  const days = Array.from({ length: mi.daysInMonth }, (_, i) => ({ day: i + 1, net: 0, quantity: 0, count: 0, returns: 0 }));
  for (const s of report.sales) {
    const d = Number(String(s.date).slice(8, 10));
    const row = days[d - 1];
    if (!row) continue;
    const sign = s.isReturn ? -1 : 1;
    row.net += sign * s.net;
    row.quantity += sign * s.quantity;
    if (s.isReturn) row.returns += 1;
    else row.count += 1;
  }

  const t = report.totals;
  const salesGross = report.sales.filter((s) => !s.isReturn).reduce((a, s) => a + s.net, 0);
  const returnsNet = Math.abs(report.returns.net);
  const top = [...report.byBranch].sort((a, b) => b.net - a.net)[0] || null;
  const elapsed = mi.today / mi.daysInMonth;

  // comparação com o mês anterior: quanto dele já foi alcançado e o mesmo período (dia 1 até hoje)
  const prevTotal = prev?.total || 0;
  const prevSame = prev ? Object.entries(prev.byDay).reduce((a, [d, v]) => (Number(d) <= mi.today ? a + v : a), 0) : 0;

  return {
    month: mi,
    prev: prev ? { label: mi.prev.label, total: prevTotal, samePeriod: prevSame } : null,
    ofPrev: prevTotal > 0 ? t.net / prevTotal : null,
    vsSamePeriod: prevSame > 0 ? t.net / prevSame - 1 : null,
    net: t.net,
    quantity: t.quantity,
    count: t.count,
    ticket: t.count ? t.net / t.count : 0,
    projection: elapsed > 0 ? t.net / elapsed : 0,
    elapsed,
    days,
    topBranch: top ? { code: top.key, name: branchName(top.key), net: top.net, share: t.net > 0 ? top.net / t.net : 0 } : null,
    branches: report.byBranch.length,
    returnRate: salesGross > 0 ? returnsNet / salesGross : 0,
  };
}

export const getStockSnapshot = cache((allowedKey) => stockSnapshot(allowedKey).catch((e) => ({ error: e.message || String(e) })));

async function stockSnapshot(allowedKey) {
  const allowed = allowedKey ? allowedKey.split(",").map(Number) : null;
  const [bal, cond] = await Promise.all([
    fetchBalances("stores").then((d) => restrictBalances(d, allowed)),
    fetchFiscalBalance("conditional").then((d) => restrictClients(d, allowed)).catch(() => null),
  ]);
  const perBranch = new Map();
  let pieces = 0;
  const refs = new Set();
  for (const p of bal.products) {
    refs.add(p.reference);
    for (const b of p.branches || []) {
      pieces += b.stock;
      perBranch.set(b.code, (perBranch.get(b.code) || 0) + b.stock);
    }
  }
  return {
    pieces,
    references: refs.size,
    branches: [...perBranch.entries()].map(([code, stock]) => ({ code, name: branchName(code), stock })).sort((a, b) => a.code - b.code),
    conditionalPieces: cond ? cond.clients.reduce((s, c) => s + c.quantity, 0) : null,
    conditionalClients: cond ? cond.clients.length : null,
  };
}
