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
      {state?.error ? <div className="alert error" role="alert">{state.error}</div> : null}
      {state?.ok ? <div className="alert success" role="status">{state.ok}</div> : null}
      {editing ? <input type="hidden" name="id" value={user.id} /> : null}
      <div className="row">
        <label className="field" style={{ flex: "1 1 200px" }}>
          <span>Nome</span>
          <input name="name" defaultValue={user?.name || ""} autoComplete="off" required />
        </label>
        <label className="field" style={{ flex: "1 1 220px" }}>
          <span>E-mail</span>
          <input
            name="email"
            type="email"
            defaultValue={user?.email || ""}
            autoComplete="off"
            spellCheck={false}
            required={!editing}
            disabled={editing}
          />
        </label>
        <label className="field" style={{ flex: "1 1 180px" }}>
          <span>{editing ? "Nova senha" : "Senha inicial"}</span>
          <input name="password" type="password" autoComplete="new-password" required={!editing} minLength={8} />
          <span className="help">{editing ? "Deixe vazio para manter a atual." : "Mínimo de 8 caracteres."}</span>
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
        <div className="eyebrow" style={{ marginBottom: 8 }}>Acesso por módulo</div>
        <div className="table-wrap" style={{ maxHeight: "none" }}>
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
                    <label className="radio-cell">
                      <input type="radio" name={`mod_${m.id}`} value="" defaultChecked={current === ""} aria-label={`${m.name}: sem acesso`} />
                    </label>
                  </td>
                  {levels.map((l) => (
                    <td key={l.id}>
                      <label className="radio-cell">
                        <input
                          type="radio"
                          name={`mod_${m.id}`}
                          value={l.id}
                          defaultChecked={current === l.id}
                          aria-label={`${m.name}: ${l.name}`}
                        />
                      </label>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
      <div>
        <Submit label={submitLabel} />
      </div>
    </form>
  );
}
