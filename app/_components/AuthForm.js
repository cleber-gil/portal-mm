"use client";

import { useFormState, useFormStatus } from "react-dom";

function Submit({ label }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending} style={{ justifyContent: "center" }}>
      {pending ? "Aguarde…" : label}
    </button>
  );
}

// formulário genérico de login/setup ligado a uma server action
export default function AuthForm({ action, fields, submitLabel }) {
  const [state, formAction] = useFormState(action, null);
  return (
    <form action={formAction} className="stack">
      {state?.error ? <div className="alert error">{state.error}</div> : null}
      {fields.map((f) => (
        <label key={f.name}>
          {f.label}
          <input name={f.name} type={f.type || "text"} autoComplete={f.autoComplete} required />
        </label>
      ))}
      <Submit label={submitLabel} />
    </form>
  );
}
