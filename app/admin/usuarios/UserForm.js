"use client";

import { useFormState, useFormStatus } from "react-dom";

function Submit({ label }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? "Salvando…" : label}
    </button>
  );
}

// formulário de criar/editar usuário com a matriz de módulos
export default function UserForm({ action, modules, levels, user, submitLabel }) {
  const [state, formAction] = useFormState(action, null);
  const editing = !!user;
  return (
    <form action={formAction} className="stack" key={state?.ok || "form"}>
      {state?.error ? <div className="alert error">{state.error}</div> : null}
      {state?.ok ? <div className="alert success">{state.ok}</div> : null}
      {editing ? <input type="hidden" name="id" value={user.id} /> : null}
      <div className="row">
        <label style={{ flex: "1 1 200px" }}>
          Nome
          <input name="name" defaultValue={user?.name || ""} required />
        </label>
        <label style={{ flex: "1 1 220px" }}>
          E-mail
          <input name="email" type="email" defaultValue={user?.email || ""} required={!editing} disabled={editing} />
        </label>
        <label style={{ flex: "1 1 180px" }}>
          {editing ? "Nova senha (deixe vazio p/ manter)" : "Senha inicial"}
          <input name="password" type="password" autoComplete="new-password" required={!editing} minLength={8} />
        </label>
      </div>
      <div className="row">
        <label className="check">
          <input type="checkbox" name="is_admin" defaultChecked={!!user?.is_admin} /> Administrador (acesso a tudo)
        </label>
        {editing ? (
          <label className="check">
            <input type="checkbox" name="active" defaultChecked={user.active} /> Ativo
          </label>
        ) : null}
      </div>
      <div>
        <div className="muted small" style={{ marginBottom: 6 }}>Módulos</div>
        <table>
          <thead>
            <tr>
              <th>Módulo</th>
              <th>Sem acesso</th>
              {levels.map((l) => (
                <th key={l.id}>{l.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map((m) => {
              const current = user?.modules?.[m.id] || "";
              return (
                <tr key={m.id}>
                  <td>
                    {m.name}
                    {m.type === "external" ? <span className="muted small"> (atalho)</span> : null}
                  </td>
                  <td>
                    <input type="radio" name={`mod_${m.id}`} value="" defaultChecked={current === ""} />
                  </td>
                  {levels.map((l) => (
                    <td key={l.id}>
                      <input type="radio" name={`mod_${m.id}`} value={l.id} defaultChecked={current === l.id} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div>
        <Submit label={submitLabel} />
      </div>
    </form>
  );
}
