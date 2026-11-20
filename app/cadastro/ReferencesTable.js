"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Icon } from "../_components/icons";

export default function ReferencesTable({ collection, refs: initialRefs, types, values, canEdit }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [refs, setRefs] = useState(initialRefs);
  // filtros iniciam da URL (link compartilhável) e são refletidos nela
  const [q, setQ] = useState(params.get("q") || "");
  const [missing, setMissing] = useState(params.get("sem") || ""); // typeCode sem valor
  const [famFilter, setFamFilter] = useState(params.get("familia") || ""); // código da família

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      const set = (k, v) => (v ? next.set(k, v) : next.delete(k));
      set("q", q.trim());
      set("sem", missing);
      set("familia", famFilter);
      const qs = next.toString();
      if (qs !== params.toString()) router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, missing, famFilter]);
  const [selected, setSelected] = useState(() => new Set());
  const [bulkType, setBulkType] = useState(104);
  const [bulkValue, setBulkValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const filtered = useMemo(() => {
    const term = q.trim().toUpperCase().replace(/\s+/g, "");
    return refs.filter((r) => {
      if (term && !(r.code.replace(/\s+/g, "") + r.name.replace(/\s+/g, "")).toUpperCase().includes(term)) return false;
      if (missing && r.classifications[missing]) return false;
      if (famFilter && r.classifications[104]?.code !== famFilter) return false;
      return true;
    });
  }, [refs, q, missing, famFilter]);

  const withoutFamily = refs.filter((r) => !r.classifications[104]).length;
  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.referenceId));

  function toggle(id) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function toggleAll() {
    setSelected((s) => {
      const n = new Set(s);
      if (allSelected) filtered.forEach((r) => n.delete(r.referenceId));
      else filtered.forEach((r) => n.add(r.referenceId));
      return n;
    });
  }

  async function apply() {
    const value = values[bulkType]?.find((v) => v.code === bulkValue);
    if (!value) return;
    const chosen = refs.filter((r) => selected.has(r.referenceId));
    const typeName = types.find((t) => t.code === Number(bulkType))?.name;
    if (!confirm(`Gravar ${typeName} = "${value.name}" em ${chosen.length} referência(s) no TOTVS?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/cadastro/classificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typeCode: Number(bulkType),
          valueCode: bulkValue,
          references: chosen.map((r) => ({ referenceId: r.referenceId, code: r.code })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);
      const failedIds = new Set(json.failed.map((f) => f.referenceId));
      setRefs((list) =>
        list.map((r) =>
          selected.has(r.referenceId) && !failedIds.has(r.referenceId)
            ? { ...r, classifications: { ...r.classifications, [bulkType]: { code: value.code, name: value.name } } }
            : r
        )
      );
      setSelected(new Set(json.failed.map((f) => f.referenceId)));
      setMsg(
        json.failed.length
          ? { type: "error", text: `${json.ok} gravada(s). Falharam: ${json.failed.map((f) => `${f.code} (${f.error})`).join("; ")}` }
          : { type: "success", text: `${json.ok} referência(s) atualizada(s) no TOTVS.` }
      );
      router.refresh();
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    } finally {
      setBusy(false);
    }
  }

  const totalSkus = refs.reduce((n, r) => n + r.skus, 0);
  const filled = refs.length - withoutFamily;

  return (
    <div className="stack">
      <div className="metrics">
        <div className="metric">
          <div className="value">{refs.length}</div>
          <div className="label">
            referências em {collection.code}
            {collection.name ? ` · ${collection.name}` : ""}
          </div>
        </div>
        <div className="metric">
          <div className="value" style={{ color: withoutFamily ? "var(--warn)" : "var(--ok)" }}>{withoutFamily}</div>
          <div className="label">sem família ({filled} preenchidas)</div>
        </div>
        <div className="metric">
          <div className="value">{totalSkus.toLocaleString("pt-BR")}</div>
          <div className="label">SKUs (cor × tamanho)</div>
        </div>
      </div>

      <div className="row">
        <label className="field" style={{ flex: "1 1 260px" }}>
          <span>Buscar referência ou nome</span>
          <input
            type="search"
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ex.: VC 001 ou ALINE…"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className="field">
          <span>Mostrar só sem</span>
          <select name="sem" value={missing} onChange={(e) => setMissing(e.target.value)}>
            <option value="">(todas)</option>
            {types.map((t) => (
              <option key={t.code} value={t.code}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Família</span>
          <select name="familia" value={famFilter} onChange={(e) => setFamFilter(e.target.value)}>
            <option value="">(todas)</option>
            {(values[104] || []).map((v) => (
              <option key={v.code} value={v.code}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <span className="small muted mono" style={{ paddingBottom: 10 }}>
          <span aria-live="polite">{filtered.length} exibidas</span>
        </span>
      </div>

      {msg ? (
        <div className={`alert ${msg.type}`} role="status">
          <Icon name={msg.type === "error" ? "erro" : "ok"} size={16} />
          {msg.text}
        </div>
      ) : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {canEdit ? (
                <th style={{ width: 36 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Selecionar exibidas" />
                </th>
              ) : null}
              <th>Referência</th>
              <th>Nome</th>
              {types.map((t) => (
                <th key={t.code}>{t.name}</th>
              ))}
              <th>Cores</th>
              <th>Tamanhos</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.referenceId}
                className={selected.has(r.referenceId) ? "selected" : ""}
                onClick={canEdit ? (e) => e.target.tagName !== "INPUT" && toggle(r.referenceId) : undefined}
                style={canEdit ? { cursor: "pointer" } : undefined}
              >
                {canEdit ? (
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(r.referenceId)}
                      onChange={() => toggle(r.referenceId)}
                      aria-label={`Selecionar ${r.code}`}
                    />
                  </td>
                ) : null}
                <td>
                  <span className="mono" translate="no" style={{ fontWeight: 500 }}>
                    {r.code}
                  </span>
                  {!r.active ? (
                    <span className="chip missing" style={{ marginLeft: 8 }}>
                      inativo
                    </span>
                  ) : null}
                </td>
                <td className="text-2">
                  <span className="truncate" title={r.name}>
                    {r.name}
                  </span>
                </td>
                {types.map((t) => {
                  const c = r.classifications[t.code];
                  const mixed = r.mixed.includes(t.code);
                  return (
                    <td key={t.code}>
                      {c ? (
                        <span
                          className={`chip${mixed ? " missing" : t.code === 104 ? " accent" : ""}`}
                          title={mixed ? "Valores diferentes entre os SKUs" : `Código ${c.code}`}
                        >
                          {c.name || c.code}
                        </span>
                      ) : (
                        <span className="chip missing">vazio</span>
                      )}
                    </td>
                  );
                })}
                <td className="mono muted" title={r.colors.join(", ")}>
                  {r.colors.length}
                </td>
                <td className="mono muted small">{r.sizes.join(" ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <div className="empty">
            <Icon name="busca" size={28} />
            <b>Nenhuma referência com esses filtros.</b>
            <span>
              {refs.length === 0
                ? `A coleção ${collection.code} ainda não tem produtos cadastrados no TOTVS.`
                : "Limpe a busca ou troque o filtro para ver as demais."}
            </span>
          </div>
        ) : null}
      </div>

      {canEdit && selected.size > 0 ? (
        <div className="bulkbar" role="region" aria-label="Aplicar classificação">
          <div style={{ alignSelf: "center" }}>
            <span className="mono" style={{ fontSize: 20, fontWeight: 500 }}>{selected.size}</span>
            <span style={{ color: "#b8b8bf", marginLeft: 6 }}>selecionada(s)</span>
          </div>
          <label className="field">
            <span>Classificação</span>
            <select
              value={bulkType}
              onChange={(e) => {
                setBulkType(Number(e.target.value));
                setBulkValue("");
              }}
            >
              {types.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.code} {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Valor</span>
            <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}>
              <option value="">Escolha…</option>
              {(values[bulkType] || []).map((v) => (
                <option key={v.code} value={v.code}>
                  {v.code} · {v.name}
                </option>
              ))}
            </select>
          </label>
          <button className="btn" onClick={apply} disabled={!bulkValue || busy}>
            {busy ? "Gravando no TOTVS…" : "Aplicar no TOTVS"}
          </button>
          <button className="btn ghost" onClick={() => setSelected(new Set())}>
            <Icon name="fechar" size={16} />
            Limpar
          </button>
        </div>
      ) : null}
    </div>
  );
}
