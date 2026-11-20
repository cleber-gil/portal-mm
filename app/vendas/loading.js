import "./vendas.css";

// esqueleto exibido enquanto as vendas são buscadas no TOTVS
export default function Loading() {
  return (
    <>
    <div className="topbar-skeleton" aria-hidden="true" />
    <main className="page vendas" aria-busy="true" aria-label="Carregando vendas">
      <div className="head">
        <div style={{ display: "grid", gap: 12 }}>
          <div className="skeleton" style={{ width: 180, height: 12 }} />
          <div className="skeleton" style={{ width: 260, height: 30 }} />
          <div className="skeleton" style={{ width: 320, height: 14 }} />
        </div>
      </div>
      <div className="skeleton" style={{ height: 66, marginBottom: 28 }} />
      <div className="metrics">
        {[44, 30, 30, 30].map((h, i) => (
          <div className={`metric${i === 0 ? " primary" : ""}`} key={i}>
            <div className="skeleton" style={{ width: i === 0 ? 220 : 110, height: h }} />
            <div className="skeleton" style={{ width: 120, height: 12, marginTop: 8 }} />
          </div>
        ))}
      </div>
      <div className="charts">
        {[8, 6].map((n, k) => (
          <div key={k} className="bars">
            {Array.from({ length: n }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 14, width: `${95 - i * 9}%` }} />
            ))}
          </div>
        ))}
      </div>
      <p className="small text-2" aria-live="polite">Buscando vendas no TOTVS…</p>
    </main>
    </>
  );
}
