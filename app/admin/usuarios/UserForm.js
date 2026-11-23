"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import PasswordInput from "../../_components/PasswordInput";

function Submit({ label }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? "Salvando…" : label}
    </button>
  );
}

const RANK = { view: 1, edit: 2 };

// formulário de criar/editar usuário; só oferece o que o ator pode conceder
export default function UserForm({ action, actor, modules, levels, branches, roles, managers, user, submitLabel }) {
  const [state, formAction] = useFormState(action, null);
  const editing = !!user;
  const actorIsAdmin = actor.role === "admin";
  const [role, setRole] = useState(user?.role || "usuario");
  const [allBranches, setAllBranches] = useState(!!user?.all_branches);
  const actorSeesAll = actorIsAdmin || actor.all_branches;
  const grantableModules = modules.filter((m) => actorIsAdmin || actor.modules[m.id]);
  const grantableBranches = actorSeesAll ? branches : branches.filter((b) => actor.branches.includes(b.code));
  const isTargetAdmin = role === "admin";

  return (
    <form action={formAction} className="stack" key={state?.ok || "form"}>
      {state?.error ? (
        <div className="alert error" role="alert">
          {state.error}
        </div>
      ) : null}
      {state?.ok ? (
        <div className="alert success" role="status">
          {state.ok}
        </div>
      ) : null}
      {editing ? <input type="hidden" name="id" value={user.id} /> : null}

      <div className="row top">
        <label className="field" style={{ flex: "1 1 200px" }}>
          <span>Nome</span>
          <input name="name" defaultValue={user?.name || ""} autoComplete="off" required />
        </label>
        <label className="field" style={{ flex: "1 1 220px" }}>
          <span>Usuário ou e-mail</span>
          <input
            name="email"
            type="text"
            autoCapitalize="none"
            defaultValue={user?.email || ""}
            autoComplete="off"
            spellCheck={false}
            required={!editing}
            disabled={editing}
          />
          {!editing ? <span className="help">Pode ser só um nome de usuário, ex.: loja.paulista</span> : null}
        </label>
        <label className="field" style={{ flex: "1 1 180px" }}>
          <span>{editing ? "Nova senha" : "Senha inicial"}</span>
          <PasswordInput name="password" autoComplete="new-password" required={!editing} minLength={8} />
          <span className="help">{editing ? "Deixe vazio para manter a atual." : "Mínimo de 8 caracteres."}</span>
        </label>
      </div>

      {actorIsAdmin ? (
        <div className="row top">
          <label className="field" style={{ flex: "0 1 220px" }}>
            <span>Perfil</span>
            <select name="role" value={role} onChange={(e) => setRole(e.target.value)}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <span className="help">{roles.find((r) => r.id === role)?.description}</span>
          </label>
          {role === "usuario" ? (
            <label className="field" style={{ flex: "0 1 260px" }}>
              <span>Gestor responsável</span>
              <select name="manager_id" defaultValue={user?.manager_id || ""}>
                <option value="">Nenhum (só o administrador gerencia)</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : (
        <p className="small text-2">
          Perfil: Usuário da sua equipe. Você só pode liberar módulos e filiais que você mesmo tem.
        </p>
      )}

      {role === "usuario" ? (
        <label className="field" style={{ maxWidth: 260 }}>
          <span>CPF da vendedora (CRM)</span>
          <input
            name="crm_cpf"
            defaultValue={user?.crm_cpf || ""}
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            placeholder="000.000.000-00…"
          />
          <span className="help">Obrigatório para liberar o CRM. Define a carteira de clientes dela.</span>
        </label>
      ) : null}

      {editing ? (
        <label className="check">
          <input type="checkbox" name="active" defaultChecked={user.active} /> Ativo (pode entrar no portal)
        </label>
      ) : null}

      {isTargetAdmin ? (
        <p className="small text-2">Administrador acessa todos os módulos e filiais.</p>
      ) : (
        <>
          <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 8 }}>
            <legend className="eyebrow" style={{ marginBottom: 8 }}>
              Filiais
            </legend>
            {actorSeesAll ? (
              <label className="check">
                <input
                  type="checkbox"
                  name="all_branches"
                  checked={allBranches}
                  onChange={(e) => setAllBranches(e.target.checked)}
                />{" "}
                Todas as filiais (inclui as que forem abertas no futuro)
              </label>
            ) : null}
            {!allBranches ? (
              <div className="branch-grid">
                {grantableBranches.map((b) => (
                  <label key={b.code} className="check">
                    <input
                      type="checkbox"
                      name="branches"
                      value={b.code}
                      defaultChecked={user?.branches?.includes(b.code)}
                    />{" "}
                    {b.name}
                  </label>
                ))}
              </div>
            ) : null}
          </fieldset>

          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Acesso por módulo
            </div>
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
                  {grantableModules.map((m) => {
                    const current = user?.modules?.[m.id] || "";
                    const cap = actorIsAdmin ? 2 : RANK[actor.modules[m.id]] || 0;
                    return (
                      <tr key={m.id}>
                        <td>
                          {m.name}
                          {m.type === "external" ? <span className="muted small"> (atalho)</span> : null}
                        </td>
                        <td>
                          <label className="radio-cell">
                            <input
                              type="radio"
                              name={`mod_${m.id}`}
                              value=""
                              defaultChecked={current === ""}
                              aria-label={`${m.name}: sem acesso`}
                            />
                          </label>
                        </td>
                        {levels.map((l) => (
                          <td key={l.id}>
                            {RANK[l.id] <= cap ? (
                              <label className="radio-cell">
                                <input
                                  type="radio"
                                  name={`mod_${m.id}`}
                                  value={l.id}
                                  defaultChecked={current === l.id}
                                  aria-label={`${m.name}: ${l.name}`}
                                />
                              </label>
                            ) : (
                              <span className="muted small">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div>
        <Submit label={submitLabel} />
      </div>
    </form>
  );
}
