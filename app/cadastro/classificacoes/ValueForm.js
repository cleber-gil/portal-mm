"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveValueAction } from "./actions";

function Submit({ label }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? "Gravando…" : label}
    </button>
  );
}

// novo valor (sem code) ou renomear (com code)
export default function ValueForm({ typeCode, value, compact }) {
  const [state, action] = useActionState(saveValueAction, null);
  return (
    <form action={action} className="row" style={{ gap: 8 }}>
      <input type="hidden" name="typeCode" value={typeCode} />
      {value ? <input type="hidden" name="code" value={value.code} /> : null}
      <input
        name="name"
        defaultValue={value?.name || ""}
        placeholder={value ? undefined : "Ex.: RENDA GARDEN…"}
        aria-label={value ? `Nome de ${value.code}` : "Nome do novo valor"}
        autoComplete="off"
        required
        maxLength={40}
        style={{ flex: compact ? "1 1 160px" : "1 1 260px" }}
      />
      <Submit label={value ? "Renomear" : "Adicionar"} />
      <span aria-live="polite" className="small" style={{ color: state?.error ? "var(--danger)" : "var(--ok)" }}>
        {state?.error || state?.ok || ""}
      </span>
    </form>
  );
}
