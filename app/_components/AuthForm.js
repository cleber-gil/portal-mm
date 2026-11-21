"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Icon } from "./icons";
import PasswordInput from "./PasswordInput";

function Submit({ label }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending} style={{ width: "100%", padding: "11px 16px" }}>
      {pending ? "Aguarde…" : label}
    </button>
  );
}

// formulário genérico de login/setup ligado a uma server action
export default function AuthForm({ action, fields, submitLabel }) {
  const [state, formAction] = useFormState(action, null);
  return (
    <form action={formAction} className="stack" style={{ gap: 16 }}>
      {state?.error ? (
        <div className="alert error" role="alert">
          <Icon name="erro" size={16} />
          {state.error}
        </div>
      ) : null}
      {fields.map((f) => (
        <label key={f.name} className="field">
          <span>{f.label}</span>
          {f.type === "password" ? (
            <PasswordInput name={f.name} autoComplete={f.autoComplete || "current-password"} required />
          ) : (
            <input
              name={f.name}
              type={f.type || "text"}
              autoComplete={f.autoComplete || "off"}
              spellCheck={f.type === "email" ? false : undefined}
              required
            />
          )}
          {f.help ? <span className="help">{f.help}</span> : null}
        </label>
      ))}
      <Submit label={submitLabel} />
    </form>
  );
}
