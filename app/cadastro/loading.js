// esqueleto exibido enquanto a coleção é buscada no TOTVS (pode levar alguns segundos)
export default function Loading() {
  const rows = Array.from({ length: 10 });
  return (
    <>
    <div className="topbar-skeleton" aria-hidden="true" />
    <main className="page" aria-busy="true" aria-label="Carregando referências">
      <div className="page-head">
        <div style={{ display: "grid", gap: 12 }}>
          <div className="skeleton" style={{ width: 150, height: 12 }} />
          <div className="skeleton" style={{ width: 300, height: 28 }} />
          <div className="skeleton" style={{ width: 420, height: 14 }} />
        </div>
      </div>
      <div className="stack">
        <div className="skeleton" style={{ width: 280, height: 40 }} />
        <div className="metrics">
          {[0, 1, 2].map((i) => (
            <div className="metric" key={i}>
              <div className="skeleton" style={{ width: 70, height: 28 }} />
              <div className="skeleton" style={{ width: 120, height: 12, marginTop: 8 }} />
            </div>
          ))}
        </div>
        <div className="table-wrap" style={{ padding: 12, display: "grid", gap: 12 }}>
          {rows.map((_, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "20px 120px 2fr 1fr 1fr 1fr 1fr", gap: 16 }}>
              {Array.from({ length: 7 }).map((__, j) => (
                <div key={j} className="skeleton" style={{ height: 16 }} />
              ))}
            </div>
          ))}
        </div>
        <p className="small text-2" aria-live="polite">Buscando referências no TOTVS…</p>
      </div>
    </main>
    </>
  );
}
