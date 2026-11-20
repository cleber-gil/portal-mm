"use client";

import { useEffect, useState } from "react";
import { Icon } from "./icons";

// No celular, recolhe um bloco (ex.: filtros) atrás de um botão; no computador fica sempre aberto
export default function MobileCollapse({ label = "Filtros", summary, children }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (window.matchMedia("(max-width: 760px)").matches) setOpen(false);
  }, []);
  return (
    <details className="m-collapse" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <Icon name="filtro" size={16} />
        <b>{label}</b>
        {summary ? <span className="m-sum">{summary}</span> : null}
      </summary>
      {children}
    </details>
  );
}
