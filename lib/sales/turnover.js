// giro e cobertura de estoque dos produtos vendidos (Painel de Vendas)
import { fetchBalances } from "../totvs/stock";

// saldo físico das lojas (mesmo cache do módulo Estoque)
export async function fetchStock() {
  return fetchBalances("stores");
}

// índice reference|color|size -> { stock } para cruzar com as vendas
export function indexStockByProduct(stockJson) {
  const map = new Map();
  for (const p of stockJson?.products || []) {
    map.set(`${p.reference}|${p.color}|${p.size}`, { stock: p.stock });
  }
  return map;
}

// giro = peças vendidas no período ÷ estoque atual
// coberturaDias = quantos dias o estoque atual dura no ritmo médio de vendas do período
export function computeTurnover({ quantitySold, currentStock, periodDays }) {
  const days = periodDays > 0 ? periodDays : null;
  const avgDailySales = days ? quantitySold / days : null;

  let turnoverRatio = null;
  if (currentStock > 0) {
    turnoverRatio = quantitySold / currentStock;
  } else if (quantitySold > 0) {
    turnoverRatio = null; // sem estoque mas vendeu — "giro infinito", tratado à parte
  } else {
    turnoverRatio = 0;
  }

  let daysOfCoverage = null;
  if (avgDailySales && avgDailySales > 0) {
    daysOfCoverage = currentStock / avgDailySales;
  } else if (currentStock > 0) {
    daysOfCoverage = Infinity; // tem estoque, não vendeu nada no período — parado
  } else {
    daysOfCoverage = 0;
  }

  return {
    currentStock,
    turnoverRatio,
    daysOfCoverage,
    zeroStockButSelling: currentStock <= 0 && quantitySold > 0,
  };
}
