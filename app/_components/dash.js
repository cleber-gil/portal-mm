// Peças visuais da tela inicial (SVG puro, renderizadas no servidor)
const rad = (deg) => (deg * Math.PI) / 180;
const polar = (cx, cy, r, deg) => [cx + r * Math.cos(rad(deg)), cy - r * Math.sin(rad(deg))];
function arc(cx, cy, r, from, to) {
  const [x1, y1] = polar(cx, cy, r, from);
  const [x2, y2] = polar(cx, cy, r, to);
  const large = Math.abs(from - to) > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}
const clamp = (v) => Math.max(0, Math.min(1, Number(v) || 0));

// medidor grande da área de destaque: 0–100 em 220°, com o emblema da Martha Medeiros no centro
export function HeroGauge({ value, label }) {
  const v = clamp(value);
  const START = 200, SWEEP = 220;
  const at = (p) => START - SWEEP * p;
  const ticks = Array.from({ length: 11 }, (_, i) => i / 10);
  const [mx, my] = polar(200, 200, 150, at(v));
  return (
    <svg viewBox="0 0 400 400" className="hero-gauge" role="img" aria-label={label}>
      <defs>
        <linearGradient id="hg" x1="0" x2="1">
          <stop offset="0%" stopColor="#f6c27a" />
          <stop offset="100%" stopColor="#ee9a30" />
        </linearGradient>
      </defs>
      <circle cx="200" cy="200" r="182" fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.55)" />
      <path d={arc(200, 200, 150, START, START - SWEEP)} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="2" />
      <path className="draw" d={arc(200, 200, 150, START, at(v))} fill="none" stroke="url(#hg)" strokeWidth="5" strokeLinecap="round" pathLength="1" />
      {ticks.map((t) => {
        const [x1, y1] = polar(200, 200, 150, at(t));
        const [x2, y2] = polar(200, 200, 140, at(t));
        const [tx, ty] = polar(200, 200, 168, at(t));
        const on = Math.abs(t - Math.round(v * 10) / 10) < 0.001;
        return (
          <g key={t}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#9fb1bd" strokeWidth="1.5" />
            <text x={tx} y={ty + 4} textAnchor="middle" fontSize={on ? 15 : 11} fill={on ? "#ee9a30" : "#8a9aa6"} fontWeight={on ? 600 : 400}>
              {Math.round(t * 100)}
            </text>
          </g>
        );
      })}
      <circle cx={mx} cy={my} r="6" fill="#ee9a30" stroke="#fff" strokeWidth="2.5" className="pulse-dot" />
      <circle cx="200" cy="200" r="104" fill="rgba(255,255,255,0.55)" />
      <circle cx="200" cy="200" r="82" fill="#fffaf3" stroke="url(#hg)" strokeWidth="2" className="hub" />
      <image href="/mm-emblema.webp" x="161" y="144" width="78" height="112" className="hub" preserveAspectRatio="xMidYMid meet" aria-hidden="true" />
    </svg>
  );
}

// barras duplas por dia, simétricas na linha do meio (como "Wind Energy"): cinza = peças, âmbar = valor
export function DayBars({ days, today }) {
  const maxNet = Math.max(...days.map((d) => d.net), 1);
  const maxQty = Math.max(...days.map((d) => d.quantity), 1);
  const w = 100 / days.length;
  return (
    <svg viewBox="0 0 100 60" preserveAspectRatio="none" className="day-bars" aria-hidden="true">
      <line x1="0" y1="30" x2="100" y2="30" stroke="#eef2f5" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
      {days.map((d, i) => {
        const x = i * w + w / 2;
        const hq = (Math.max(0, d.quantity) / maxQty) * 26;
        const hn = (Math.max(0, d.net) / maxNet) * 26;
        const future = d.day > today;
        return (
          <g key={d.day} style={{ "--i": i }} className={future ? "future" : ""}>
            <rect className="bar-q" x={x - 0.9} y={30 - hq * 0.8} width="0.6" height={hq * 1.6} rx="0.3" fill="#d9e2e8" />
            <rect className="bar-n" x={x + 0.1} y={30 - hn} width="0.8" height={Math.max(hn * 2, future ? 0 : 0.6)} rx="0.4" fill="#ee9a30" />
          </g>
        );
      })}
    </svg>
  );
}

// meio-círculo (como "Total Energy Generated")
export function HalfGauge({ value, center, sub }) {
  const v = clamp(value);
  return (
    <svg viewBox="0 0 200 116" className="half-gauge" role="img" aria-label={`${Math.round(v * 100)}%`}>
      <defs>
        <linearGradient id="hgauge" x1="0" x2="1">
          <stop offset="0%" stopColor="#f6c27a" />
          <stop offset="100%" stopColor="#ee9a30" />
        </linearGradient>
      </defs>
      <path d={arc(100, 104, 84, 180, 0)} fill="none" stroke="#eef2f5" strokeWidth="12" strokeLinecap="round" />
      <path className="draw" d={arc(100, 104, 84, 180, 180 - 180 * v)} fill="none" stroke="url(#hgauge)" strokeWidth="12" strokeLinecap="round" pathLength="1" />
      <text x="100" y="92" textAnchor="middle" fontSize="17" fontWeight="500" fill="#15212b">{center}</text>
      {sub ? <text x="100" y="110" textAnchor="middle" fontSize="9.5" fill="#8796a1">{sub}</text> : null}
    </svg>
  );
}

// matriz de pontos (como "System Efficiency")
export function DotColumns({ values, rows = 7 }) {
  const max = Math.max(...values, 1);
  return (
    <svg viewBox={`0 0 ${values.length * 12} ${rows * 9}`} className="dot-cols" aria-hidden="true">
      {values.map((v, c) => {
        const on = Math.round((Math.max(0, v) / max) * rows);
        return Array.from({ length: rows }, (_, r) => (
          <circle key={`${c}-${r}`} cx={c * 12 + 6} cy={(rows - r) * 9 - 4.5} r="2.1" fill={r < on ? "#ee9a30" : "#ece3d6"} style={{ "--i": c }} className={r < on ? "dot on" : "dot"} />
        ));
      })}
    </svg>
  );
}

// mostrador do mês (como o disco do "Overview"): dias ao redor, hoje em âmbar
export function MonthDial({ today, days }) {
  const ticks = Array.from({ length: days }, (_, i) => i + 1);
  return (
    <svg viewBox="0 0 200 200" className="dial" role="img" aria-label={`Dia ${today} de ${days}`}>
      <defs>
        <radialGradient id="orb" cx="40%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#fde3c0" />
          <stop offset="100%" stopColor="#ee9a30" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="92" fill="#f4f7f9" />
      <circle cx="100" cy="100" r="66" fill="#fff" />
      {ticks.map((d) => {
        const deg = 90 - (360 * (d - 1)) / days;
        const [x1, y1] = polar(100, 100, 84, deg);
        const [x2, y2] = polar(100, 100, d % 5 === 0 ? 74 : 79, deg);
        const [tx, ty] = polar(100, 100, 62, deg);
        const past = d <= today;
        return (
          <g key={d}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={d === today ? "#ee9a30" : past ? "#c3cfd7" : "#e3eaef"} strokeWidth={d === today ? 3 : 1.4} strokeLinecap="round" />
            {d % 5 === 0 ? (
              <text x={tx} y={ty + 3} textAnchor="middle" fontSize="8" fill="#9aa8b2">
                {String(d).padStart(2, "0")}
              </text>
            ) : null}
          </g>
        );
      })}
      <circle cx="100" cy="100" r="40" fill="url(#orb)" className="hub" />
      <text x="100" y="98" textAnchor="middle" fontSize="18" fontWeight="600" fill="#15212b">{today}</text>
      <text x="100" y="112" textAnchor="middle" fontSize="8.5" fill="#5b4a33">de {days}</text>
    </svg>
  );
}

// rosa dos ventos das lojas (como "Wind & Nacelle"): cada loja um ponto, tamanho pelo saldo
export function StoreCompass({ stores }) {
  const max = Math.max(...stores.map((s) => s.stock), 1);
  const n = Math.max(stores.length, 1);
  return (
    <svg viewBox="0 0 220 220" className="compass" role="img" aria-label="Saldo por loja">
      <defs>
        <radialGradient id="cmp" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fdf1e1" />
          <stop offset="100%" stopColor="#fdf1e1" stopOpacity="0.2" />
        </radialGradient>
      </defs>
      <circle cx="110" cy="110" r="88" fill="url(#cmp)" stroke="#f1e3cf" />
      <circle cx="110" cy="110" r="58" fill="none" stroke="#f3e8d9" strokeDasharray="2 4" />
      {Array.from({ length: 72 }, (_, i) => {
        const [x1, y1] = polar(110, 110, 88, i * 5);
        const [x2, y2] = polar(110, 110, i % 18 === 0 ? 80 : 84, i * 5);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#efd9bb" strokeWidth={i % 18 === 0 ? 1.6 : 0.8} />;
      })}
      <line x1="22" y1="110" x2="198" y2="110" stroke="#f0dcc0" />
      <line x1="110" y1="22" x2="110" y2="198" stroke="#f0dcc0" />
      {stores.map((s, i) => {
        const deg = 90 - (360 * i) / n;
        const share = s.stock / max;
        const [x, y] = polar(110, 110, 22 + 50 * share, deg);
        const [lx, ly] = polar(110, 110, 102, deg);
        return (
          <g key={s.code} style={{ "--i": i }} className="store">
            <line x1="110" y1="110" x2={x} y2={y} stroke="#f6c27a" strokeWidth="1" />
            <circle cx={x} cy={y} r={3 + 5 * share} fill="#ee9a30" fillOpacity={0.35 + 0.65 * share} />
            <text x={lx} y={ly + 3} textAnchor="middle" fontSize="8.5" fill="#7d8b96">
              {s.name.slice(0, 3).toUpperCase()}
            </text>
          </g>
        );
      })}
      <circle cx="110" cy="110" r="5" fill="#ee9a30" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}
