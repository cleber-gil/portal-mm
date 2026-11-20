// integra com o app de estoque separado (Martha Medeiros), que já expõe
// saldo de estoque por referência/cor/tamanho/loja, vindo do TOTVS Moda API V2
const STOCK_API_URL = "https://estoque-martha-medeiros.vercel.app/api/stock?scope=stores";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min — a origem já atualiza a cada 10 min

let cache = null; // { data, expires }

// mapa código de loja -> nome, capturado do <select> de filtro do app de estoque
// (esse app usa códigos de filial DIFERENTES do /api/sales, então o cruzamento
// entre os dois sistemas é feito por NOME normalizado, não por código)
export const STOCK_BRANCH_NAMES = {
  2: "ESPÍRITO SANTO OFICIAL",
  5: "MELO OFICIAL",
  6: "IGUATEMI OFICIAL",
  7: "TANGARÁ OFICIAL",
  9: "GOIÂNIA OFICIAL",
  10: "NOIVA OFICIAL",
  11: "CURITIBA OFICIAL",
  12: "FLAMBOYANT OFICIAL",
};

const NOISE_WORDS = new Set([
  "MEDEIROS",
  "VESTUARIO",
  "E",
  "CONFECCOES",
  "LTDA",
  "OFICIAL",
  "INDUSTRIA",
  "DE",
  "MM",
]);

// normaliza um nome de filial (de qualquer um dos dois sistemas) pra uma chave
// comparável — remove acento, maiúsculas, e palavras de ruído comuns
// ("MEDEIROS VESTUARIO E CONFECCOES - MELO" e "MELO OFICIAL" viram ambos "MELO")
export function normalizeBranchKey(name) {
  const noAccents = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const tokens = noAccents
    .toUpperCase()
    .split(/[\s-]+/)
    .filter(Boolean)
    .filter((t) => !NOISE_WORDS.has(t));
  return tokens.join(" ").trim();
}

export async function fetchStock() {
  if (cache && cache.expires > Date.now()) return cache.data;

  const res = await fetch(STOCK_API_URL, { cache: "no-store" });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // não é JSON — erro abaixo carrega o texto cru
  }

  if (!res.ok) {
    throw new Error(
      `Falha ao buscar estoque (HTTP ${res.status}): ${json ? JSON.stringify(json) : text.slice(0, 300)}`
    );
  }

  cache = { data: json, expires: Date.now() + CACHE_TTL_MS };
  return json;
}

// índice reference|color|size -> { stock total, stockByBranchKey: { [chave normalizada]: qty } }
export function indexStockByProduct(stockJson) {
  const map = new Map();
  for (const p of stockJson?.products || []) {
    const key = `${p.reference}|${p.color}|${p.size}`;
    const stockByBranchKey = {};
    for (const b of p.branches || []) {
      const branchName = STOCK_BRANCH_NAMES[b.code] || `LOJA ${b.code}`;
      const bKey = normalizeBranchKey(branchName) || `LOJA ${b.code}`;
      stockByBranchKey[bKey] = (stockByBranchKey[bKey] || 0) + b.stock;
    }
    map.set(key, { stock: p.stock, stockByBranchKey });
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
