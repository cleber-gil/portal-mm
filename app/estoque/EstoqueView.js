"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "../_components/icons";
import MobileCollapse from "../_components/MobileCollapse";

const INT = new Intl.NumberFormat("pt-BR");
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const DT = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const qty = (v) => INT.format(Number(v) || 0);
const money = (v) => BRL.format(Number(v) || 0);
const REFRESH_MS = 10 * 60 * 1000;
const ROW_LIMIT = 500;

const VIEWS = [
  { id: "stores", name: "Lojas", note: "Saldo 1 físico · lojas, sem Matriz e sem consignação" },
  { id: "matrix", name: "Matriz", note: "Saldo 1 físico · somente Matriz" },
  { id: "consignment", name: "Consignação", note: "Saldo pelas notas: remessa 5917 − devolução 1918 − retorno simbólico 1919, desde 01/01/2025" },
  { id: "conditional", name: "Condicional", note: "Saldo pelas notas: remessa 5912 − retorno 1913, últimos 3 meses" },
];
const FISCAL = new Set(["consignment", "conditional"]);

function download(name, type, content) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

function Bars({ title, rows }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <section aria-label={title}>
      <div className="section-title">
        <h2>{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="small muted">Sem saldo nos filtros atuais.</p>
      ) : (
        <div className="bars">
          {rows.map((r) => (
            <div className="bar" key={r.code} title={`${r.name}: ${qty(r.value)}`}>
              <span className="name">{r.name}</span>
              <span className="track" aria-hidden="true">
                <span className="fill" style={{ "--w": r.value / max }} />
              </span>
              <span className="val">{qty(r.value)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function EstoqueView({ branches, restricted, canMatrix }) {
  const views = VIEWS.filter((v) => v.id !== "matrix" || canMatrix);
  const nameOf = useMemo(() => Object.fromEntries(branches.map((b) => [b.code, b.name])), [branches]);
  const [view, setView] = useState("stores");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [branch, setBranch] = useState("");
  const [search, setSearch] = useState("");
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [open, setOpen] = useState(null);
  const fiscal = FISCAL.has(view);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    const url = fiscal ? `/api/estoque/fiscal?type=${view}` : `/api/estoque/saldo?scope=${view}`;
    fetch(url)
      .then(async (r) => ({ ok: r.ok, body: await r.json() }))
      .then(({ ok, body }) => {
        if (!ok) throw new Error(body.error || "Falha ao consultar o estoque");
        setData(body);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [view, fiscal]);

  useEffect(() => {
    setData(null);
    load();
    const t = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(t);
  }, [load]);

  function switchView(id) {
    setView(id);
    setBranch("");
    setColor("");
    setSize("");
    setOpen(null);
  }

  // ---------- saldo (lojas/matriz) ----------
  const products = !fiscal ? data?.products ?? [] : [];
  const colorOptions = useMemo(() => [...new Set(products.map((p) => p.color).filter(Boolean))].sort(), [products]);
  const sizeOptions = useMemo(() => [...new Set(products.map((p) => p.size).filter(Boolean))].sort(), [products]);
  const stockRows = useMemo(() => {
    const term = search.trim().toUpperCase().replace(/\s+/g, "");
    return products
      .filter(
        (p) =>
          (!term || (p.reference + p.name).toUpperCase().replace(/\s+/g, "").includes(term)) &&
          (!color || p.color === color) &&
          (!size || p.size === size)
      )
      .flatMap((p) =>
        p.branches.filter((b) => !branch || b.code === Number(branch)).map((b) => ({ ...p, branchCode: b.code, branchStock: b.stock }))
      )
      .sort((a, b) => b.branchStock - a.branchStock);
  }, [products, search, color, size, branch]);

  // ---------- condicional/consignado ----------
  const clients = fiscal ? data?.clients ?? [] : [];
  const clientRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return clients.filter(
      (c) =>
        (!branch || c.branchCode === Number(branch)) &&
        (!term ||
          c.personName.toLowerCase().includes(term) ||
          c.products.some((p) => p.description.toLowerCase().includes(term) || String(p.sku || p.code || "").includes(term)))
    );
  }, [clients, branch, search]);

  const perBranch = useMemo(() => {
    const totals = {};
    if (fiscal) for (const c of clientRows) totals[c.branchCode] = (totals[c.branchCode] || 0) + c.quantity;
    else for (const r of stockRows) totals[r.branchCode] = (totals[r.branchCode] || 0) + r.branchStock;
    return Object.entries(totals)
      .map(([code, value]) => ({ code: Number(code), name: nameOf[code] || `Loja ${code}`, value }))
      .sort((a, b) => b.value - a.value);
  }, [fiscal, clientRows, stockRows, nameOf]);

  const branchChoices = branches.filter((b) => (view === "matrix" ? b.code === 1 : view === "stores" ? b.code !== 1 : true));

  // ---------- métricas ----------
  const metrics = fiscal
    ? [
        { label: "Peças em aberto", value: qty(clientRows.reduce((s, c) => s + c.quantity, 0)), primary: true },
        { label: "Valor em aberto", value: money(clientRows.reduce((s, c) => s + c.value, 0)) },
        { label: "Clientes", value: qty(clientRows.length) },
        { label: "Mais antiga (dias)", value: qty(clientRows.reduce((m, c) => Math.max(m, c.days), 0)) },
      ]
    : [
        { label: "Peças em saldo", value: qty(stockRows.reduce((s, r) => s + r.branchStock, 0)), primary: true },
        { label: "SKUs (cor/tam.)", value: qty(new Set(stockRows.map((r) => `${r.reference}|${r.color}|${r.size}`)).size) },
        { label: "Referências", value: qty(new Set(stockRows.map((r) => r.reference)).size) },
        { label: "Lojas com saldo", value: qty(perBranch.length) },
      ];

  // ---------- exportação ----------
  function exportXls() {
    const lines = fiscal
      ? [
          ["Loja", "Cliente", "Telefone", "Cidade", "Dias", "Produto (SKU)", "Descrição", "Qtde", "Valor"],
          ...clientRows.flatMap((c) =>
            c.products.map((p) => [nameOf[c.branchCode] || c.branchCode, c.personName, c.phone, c.city, p.days, p.sku || p.code || "", p.description, p.quantity, p.value.toFixed(2).replace(".", ",")])
          ),
        ]
      : [
          ["Referência", "Descrição", "Cor", "Loja", "Tamanho", "Saldo"],
          ...stockRows.map((r) => [r.reference, r.name, r.color, nameOf[r.branchCode] || r.branchCode, r.size, r.branchStock]),
        ];
    download(`estoque-${view}.xls`, "application/vnd.ms-excel", lines.map((l) => l.join("\t")).join("\n"));
  }
  function exportDoc() {
    const esc = (v) => String(v ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
    const head = ["Referência", "Descrição", "Cor", "Loja", "Tamanho", "Saldo"];
    const html = `<table border="1"><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr>${stockRows
      .map((r) => `<tr>${[r.reference, r.name, r.color, nameOf[r.branchCode], r.size, r.branchStock].map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`)
      .join("")}</table>`;
    download(`estoque-${view}.doc`, "application/msword", html);
  }

  const daysChip = (d) => (d > 15 ? "chip danger" : d > 7 ? "chip warn" : "chip");
  const current = views.find((v) => v.id === view);

  return (
    <div className="estoque">
      <header className="head">
        <div>
          <div className="eyebrow" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="live-dot" aria-hidden="true" /> TOTVS Moda · atualiza a cada 10 min
          </div>
          <h1>Estoque</h1>
          <p>
            {current?.note}
            {restricted ? " · só as filiais liberadas para você" : ""}
          </p>
        </div>
        <div className="row no-print" style={{ gap: 8 }}>
          <button className="btn secondary" onClick={load} disabled={loading}>
            {loading ? "Atualizando…" : "Atualizar"}
          </button>
          <button className="btn secondary" onClick={() => window.print()}>
            <Icon name="pdf" size={16} /> PDF
          </button>
          <button className="btn secondary" onClick={exportXls} disabled={loading || !data}>
            <Icon name="excel" size={16} /> Excel
          </button>
          {!fiscal ? (
            <button className="btn secondary" onClick={exportDoc} disabled={loading || !data}>
              <Icon name="word" size={16} /> Word
            </button>
          ) : null}
        </div>
      </header>

      <div className="toolbar">
        <div className="tabs" role="group" aria-label="Tipo de saldo">
          {views.map((v) => (
            <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => switchView(v.id)}>
              {v.name}
            </button>
          ))}
        </div>
        <span className="status" aria-live="polite">
          {error ? null : loading ? "Consultando a TOTVS…" : data ? `Dados de ${DT.format(new Date(data.updatedAt))}${data.refreshing ? " · atualizando em segundo plano…" : ""}` : ""}
        </span>
      </div>

      <MobileCollapse>
      <form className="filters" onSubmit={(e) => e.preventDefault()} aria-label="Filtros">
        <label className="field">
          <span>Loja</span>
          <select value={branch} onChange={(e) => setBranch(e.target.value)} name="loja">
            <option value="">{restricted ? "Todas as minhas lojas" : "Todas as lojas"}</option>
            {branchChoices.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{fiscal ? "Cliente ou produto" : "Referência ou descrição"}</span>
          <input
            type="search"
            name="busca"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={fiscal ? "Ex.: MARIA ou VESTIDO…" : "Ex.: W27 VC 001…"}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        {!fiscal ? (
          <>
            <label className="field">
              <span>Cor</span>
              <select value={color} onChange={(e) => setColor(e.target.value)} name="cor">
                <option value="">Todas</option>
                {colorOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Tamanho</span>
              <select value={size} onChange={(e) => setSize(e.target.value)} name="tamanho">
                <option value="">Todos</option>
                {sizeOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <>
            <span />
            <span />
          </>
        )}
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            setBranch("");
            setSearch("");
            setColor("");
            setSize("");
          }}
        >
          <Icon name="fechar" size={16} /> Limpar
        </button>
      </form>
      </MobileCollapse>

      {error ? (
        <div className="alert error" role="alert" style={{ marginBottom: 20 }}>
          <Icon name="erro" size={16} />
          <span>
            Não foi possível consultar a TOTVS: {error}. Tente atualizar em alguns minutos.
            {fiscal ? " Essa consulta lê muitas notas e pode demorar até 1 minuto." : ""}
          </span>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="stack" aria-busy="true">
          <div className="metrics">
            {[0, 1, 2, 3].map((i) => (
              <div className="metric" key={i}>
                <div className="skeleton" style={{ width: i ? 90 : 160, height: 30 }} />
                <div className="skeleton" style={{ width: 110, height: 12, marginTop: 8 }} />
              </div>
            ))}
          </div>
          <div className="skeleton" style={{ height: 320 }} />
          <p className="small text-2">{fiscal ? "Lendo notas fiscais na TOTVS… pode levar até 1 minuto." : "Consultando saldos na TOTVS…"}</p>
        </div>
      ) : data ? (
        <>
          <section className="metrics" aria-label="Resumo">
            {metrics.map((m, i) => (
              <div className={`metric${m.primary ? " primary" : ""}`} key={m.label}>
                <div className="value">{m.value}</div>
                <div className="label">{m.label}</div>
              </div>
            ))}
          </section>

          <div className="layout">
            <section aria-label="Detalhamento">
              <div className="section-title">
                <h2>{fiscal ? "Clientes com saldo em aberto" : "Produtos com saldo"}</h2>
                <span className="small muted mono">
                  {qty(fiscal ? clientRows.length : stockRows.length)} {fiscal ? "clientes" : "registros"}
                </span>
              </div>
              <div className="table-wrap" style={{ maxHeight: 640 }}>
                {fiscal ? (
                  <table>
                    <thead>
                      <tr>
                        <th className="expand" aria-label="Expandir"></th>
                        <th>Cliente</th>
                        <th>Loja</th>
                        <th>Telefone</th>
                        <th>Dias</th>
                        <th className="num">Peças</th>
                        <th className="num">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientRows.map((c) => {
                        const key = `${c.branchCode}-${c.personCode ?? c.personName}`;
                        const expanded = open === key;
                        return (
                          <Fragment key={key}>
                            <tr>
                              <td className="expand">
                                <button
                                  type="button"
                                  className="btn ghost"
                                  style={{ padding: 4 }}
                                  aria-expanded={expanded}
                                  aria-label={`${expanded ? "Ocultar" : "Ver"} produtos de ${c.personName}`}
                                  onClick={() => setOpen(expanded ? null : key)}
                                >
                                  {expanded ? "−" : "+"}
                                </button>
                              </td>
                              <td>
                                <span className="truncate" title={c.personName} style={{ maxWidth: 240 }}>
                                  <b style={{ fontWeight: 500 }}>{c.personName || "—"}</b>
                                </span>
                                {c.city ? <div className="muted small">{c.city}</div> : null}
                              </td>
                              <td className="text-2">{nameOf[c.branchCode] || c.branchCode}</td>
                              <td className="mono small">{c.phone || "—"}</td>
                              <td>
                                <span className={daysChip(c.days)}>{qty(c.days)} dias</span>
                              </td>
                              <td className="num">{qty(c.quantity)}</td>
                              <td className="num">{money(c.value)}</td>
                            </tr>
                            {expanded
                              ? c.products.map((p, i) => (
                                  <tr className="sub" key={`${key}-${i}`}>
                                    <td></td>
                                    <td colSpan={3}>
                                      <span className="mono muted" translate="no">
                                        {p.sku || p.code || ""}
                                      </span>{" "}
                                      {p.description}
                                    </td>
                                    <td>
                                      <span className={daysChip(p.days)}>{qty(p.days)} dias</span>
                                    </td>
                                    <td className="num">{qty(p.quantity)}</td>
                                    <td className="num">{money(p.value)}</td>
                                  </tr>
                                ))
                              : null}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Referência</th>
                        <th>Descrição</th>
                        <th>Cor</th>
                        <th>Loja</th>
                        <th>Tam.</th>
                        <th className="num">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockRows.slice(0, ROW_LIMIT).map((r, i) => (
                        <tr key={`${r.reference}-${r.color}-${r.size}-${r.branchCode}-${i}`}>
                          <td className="mono" translate="no" style={{ fontWeight: 500 }}>
                            {r.reference}
                          </td>
                          <td>
                            <span className="truncate" title={r.name} style={{ maxWidth: 260 }}>
                              {r.name}
                            </span>
                          </td>
                          <td className="text-2">{r.color}</td>
                          <td className="text-2">{nameOf[r.branchCode] || r.branchCode}</td>
                          <td className="mono">{r.size}</td>
                          <td className="num">
                            {r.branchStock <= 2 ? <span className="chip warn">{qty(r.branchStock)}</span> : qty(r.branchStock)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {(fiscal ? clientRows.length : stockRows.length) === 0 ? (
                  <div className="empty">
                    <Icon name="busca" size={24} />
                    <b>{fiscal ? "Nada em aberto nesses filtros." : "Nenhum produto com saldo nesses filtros."}</b>
                    <span>Confira a busca ou limpe os filtros.</span>
                  </div>
                ) : null}
                {!fiscal && stockRows.length > ROW_LIMIT ? (
                  <div className="limit">
                    Exibindo os primeiros {qty(ROW_LIMIT)} de {qty(stockRows.length)} registros. Use os filtros para refinar; a exportação
                    traz todos.
                  </div>
                ) : null}
              </div>
            </section>
            <Bars title={fiscal ? "Peças em aberto por loja" : "Saldo por loja"} rows={perBranch} />
          </div>
        </>
      ) : null}
    </div>
  );
}
