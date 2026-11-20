"use client";

import { useFormState, useFormStatus } from "react-dom";
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
  const [state, action] = useFormState(saveValueAction, null);
  return (
    <form action={action} className="row" style={{ gap: 8 }}>
      <input type="hidden" name="typeCode" value={typeCode} />
      {value ? <input type="hidden" name="code" value={value.code} /> : null}
      <input
        name="name"
        defaultValue={value?.name || ""}
        placeholder={value ? "" : "Nome da nova família"}
        required
        maxLength={40}
        style={{ flex: compact ? "1 1 160px" : "1 1 260px" }}
      />
      <Submit label={value ? "Renomear" : "Adicionar"} />
      {state?.error ? <span className="small" style={{ color: "var(--danger)" }}>{state.error}</span> : null}
      {state?.ok ? <span className="small" style={{ color: "var(--ok)" }}>{state.ok}</span> : null}
    </form>
  );
}
