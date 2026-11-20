"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export default function ReferencesTable({ collection, refs: initialRefs, types, values, canEdit }) {
  const router = useRouter();
  const [refs, setRefs] = useState(initialRefs);
  const [q, setQ] = useState("");
  const [missing, setMissing] = useState(""); // typeCode sem valor
  const [famFilter, setFamFilter] = useState(""); // código da família
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

  return (
    <div className="stack">
      <div className="card stats">
        <div>
          <b>{refs.length}</b>
          <span className="muted">referências em {collection.code}</span>
        </div>
        <div>
          <b style={{ color: withoutFamily ? "var(--warn)" : "var(--ok)" }}>{withoutFamily}</b>
          <span className="muted">sem família</span>
        </div>
        <div>
          <b>{refs.reduce((s, r) => s + r.skus, 0)}</b>
          <span className="muted">SKUs (cor × tamanho)</span>
        </div>
      </div>

      <div className="row">
        <label style={{ flex: "1 1 240px" }}>
          Buscar referência ou nome
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex.: VC 001 ou ALINE" />
        </label>
        <label>
          Mostrar só sem…
          <select value={missing} onChange={(e) => setMissing(e.target.value)}>
            <option value="">(todas)</option>
            {types.map((t) => (
              <option key={t.code} value={t.code}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Família
          <select value={famFilter} onChange={(e) => setFamFilter(e.target.value)}>
            <option value="">(todas)</option>
            {(values[104] || []).map((v) => (
              <option key={v.code} value={v.code}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <span className="muted small">{filtered.length} exibidas</span>
      </div>

      {msg ? <div className={`alert ${msg.type}`}>{msg.text}</div> : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {canEdit ? (
                <th>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} title="Selecionar exibidas" />
                </th>
              ) : null}
              <th>Referência</th>
              <th>Nome</th>
              {types.map((t) => (
                <th key={t.code}>
                  {t.code} {t.name}
                </th>
              ))}
              <th>Cores</th>
              <th>Tam.</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.referenceId} className={selected.has(r.referenceId) ? "selected" : ""}>
                {canEdit ? (
                  <td>
                    <input type="checkbox" checked={selected.has(r.referenceId)} onChange={() => toggle(r.referenceId)} />
                  </td>
                ) : null}
                <td>
                  <b>{r.code}</b>
                  {!r.active ? <span className="chip missing" style={{ marginLeft: 6 }}>inativo</span> : null}
                </td>
                <td>{r.name}</td>
                {types.map((t) => {
                  const c = r.classifications[t.code];
                  return (
                    <td key={t.code}>
                      {c ? (
                        <span className={`chip${r.mixed.includes(t.code) ? " missing" : ""}`} title={r.mixed.includes(t.code) ? "Valores diferentes entre os SKUs" : c.code}>
                          {c.name || c.code}
                        </span>
                      ) : (
                        <span className="chip missing">vazio</span>
                      )}
                    </td>
                  );
                })}
                <td className="muted" title={r.colors.join(", ")}>
                  {r.colors.length}
                </td>
                <td className="muted">{r.sizes.join(" ")}</td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={20} className="muted" style={{ textAlign: "center", padding: 24 }}>
                  Nenhuma referência com esses filtros.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {canEdit && selected.size > 0 ? (
        <div className="bulkbar">
          <div style={{ alignSelf: "center" }}>
            <b>{selected.size}</b> selecionada(s)
          </div>
          <label>
            Classificação
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
          <label style={{ minWidth: 220 }}>
            Valor
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
            {busy ? "Gravando no TOTVS…" : "Aplicar"}
          </button>
          <button className="btn" style={{ background: "transparent", color: "#fff", borderColor: "#666" }} onClick={() => setSelected(new Set())}>
            Limpar seleção
          </button>
        </div>
      ) : null}
    </div>
  );
}
