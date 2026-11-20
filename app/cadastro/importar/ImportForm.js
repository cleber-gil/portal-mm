"use client";

import { useState } from "react";
import { Icon } from "../../_components/icons";

const STATUS = {
  gravar: { label: "gravar", cls: "chip accent" },
  trocar: { label: "trocar", cls: "chip missing" },
  ja_ok: { label: "já está certa", cls: "chip ok" },
  nao_encontrada: { label: "não existe no TOTVS", cls: "chip missing" },
};

export default function ImportForm() {
  const [text, setText] = useState("");
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function run(apply) {
    if (apply && !confirm(`Gravar no TOTVS: ${count("gravar") + count("trocar")} referência(s) e ${plan.newValues.length} família(s) nova(s)?`)) return;
    setBusy(apply ? "Gravando no TOTVS…" : "Simulando…");
    setError("");
    try {
      const res = await fetch("/api/cadastro/importar-familias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, apply }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);
      setPlan(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  const count = (s) => (plan?.plan || []).filter((p) => p.status === s).length;

  return (
    <div className="stack">
      <label className="field">
        <span>Cole aqui as colunas da planilha: código, peça e família</span>
        <textarea
          name="planilha"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPlan(null);
          }}
          rows={10}
          spellCheck={false}
          placeholder={"CÓDIGOS\tPEÇAS\tFAMÍLIA\nW27VC001PP\tVESTIDO CURTO ALINE\tTWEED ENTRELAÇOS…"}
          style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}
        />
        <span className="help">Selecione as 3 colunas no Excel, copie (Ctrl+C) e cole. Acentos e espaços são ajustados automaticamente.</span>
      </label>
      <div className="row">
        <button className="btn secondary" onClick={() => run(false)} disabled={!text.trim() || !!busy}>
          {busy === "Simulando…" ? busy : "Simular"}
        </button>
        <button className="btn" onClick={() => run(true)} disabled={!plan || plan.applied || !!busy || count("gravar") + count("trocar") + (plan?.newValues?.length || 0) === 0}>
          {busy === "Gravando no TOTVS…" ? busy : "Gravar no TOTVS"}
        </button>
      </div>

      {error ? (
        <div className="alert error" role="alert">
          <Icon name="erro" size={16} /> {error}
        </div>
      ) : null}

      {plan ? (
        <div className="stack" aria-live="polite">
          {plan.applied ? (
            <div className={`alert ${plan.failed.length ? "error" : "success"}`} role="status">
              {plan.ok} referência(s) gravada(s) no TOTVS.
              {plan.failed.length ? ` Falharam: ${plan.failed.map((f) => `${f.code} (${f.error})`).join("; ")}` : ""}
            </div>
          ) : null}
          <div className="metrics" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            <div className="metric">
              <div className="value">{plan.total}</div>
              <div className="label">linhas lidas ({plan.collections.join(", ")})</div>
            </div>
            <div className="metric">
              <div className="value">{count("gravar") + count("trocar")}</div>
              <div className="label">a gravar ({count("trocar")} trocam de família)</div>
            </div>
            <div className="metric">
              <div className="value">{count("ja_ok")}</div>
              <div className="label">já estavam certas</div>
            </div>
            <div className="metric">
              <div className="value" style={{ color: count("nao_encontrada") ? "var(--warn)" : undefined }}>
                {count("nao_encontrada") + plan.duplicates.length}
              </div>
              <div className="label">ignoradas (não existem ou duplicadas)</div>
            </div>
          </div>

          {plan.newValues.length ? (
            <p className="small text-2">
              Famílias novas a criar no tipo 104:{" "}
              {plan.newValues.map((v) => (
                <span key={v.code} className="chip" style={{ margin: "0 4px 4px 0" }}>
                  <span className="mono">{v.code}</span> {v.name}
                </span>
              ))}
            </p>
          ) : null}
          {plan.duplicates.length ? (
            <p className="small text-2">
              Códigos repetidos na planilha (ignorados, corrija e importe de novo): <span className="mono">{plan.duplicates.join(", ")}</span>
            </p>
          ) : null}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Peça</th>
                  <th>Família</th>
                  <th>Atual no TOTVS</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {plan.plan.map((p) => (
                  <tr key={p.code}>
                    <td className="mono" translate="no">
                      {p.totvsCode || p.code}
                    </td>
                    <td className="text-2">
                      <span className="truncate" title={p.piece}>
                        {p.piece}
                      </span>
                    </td>
                    <td>
                      <span className="mono muted">{p.familyCode}</span> {p.family}
                    </td>
                    <td className="text-2">{p.current || "—"}</td>
                    <td>
                      <span className={STATUS[p.status].cls}>{STATUS[p.status].label}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
