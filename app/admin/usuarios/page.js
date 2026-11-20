import Link from "next/link";
import Shell from "../../_components/Shell";
import UserForm from "./UserForm";
import { createUserAction } from "./actions";
import { requireManager } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import { MODULES, LEVELS } from "@/lib/modules";
import { BRANCHES, ROLES, branchName } from "@/lib/branches";

export const dynamic = "force-dynamic";
export const metadata = { title: "Usuários" };

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const fmt = (d) => (d ? DATE_FMT.format(new Date(d)) : "—");

export default async function UsersPage({ searchParams }) {
  const actor = await requireManager();
  await ensureSchema();
  const db = sql();
  const admin = actor.role === "admin";

  // admin vê todos; gestor vê só a própria equipe
  const users = admin
    ? await db`SELECT u.id, u.name, u.email, u.role, u.active, u.all_branches, u.last_login_at, m.name AS manager_name
        FROM users u LEFT JOIN users m ON m.id = u.manager_id ORDER BY u.role, u.name`
    : await db`SELECT u.id, u.name, u.email, u.role, u.active, u.all_branches, u.last_login_at, NULL AS manager_name
        FROM users u WHERE u.manager_id = ${actor.id} AND u.role = 'usuario' ORDER BY u.name`;
  const ids = users.map((u) => u.id);
  const mods = ids.length ? await db`SELECT user_id, module_id, level FROM user_modules WHERE user_id = ANY(${ids})` : [];
  const brs = ids.length ? await db`SELECT user_id, branch_code FROM user_branches WHERE user_id = ANY(${ids})` : [];
  const modsBy = {};
  for (const r of mods) (modsBy[r.user_id] ||= {})[r.module_id] = r.level;
  const brsBy = {};
  for (const r of brs) (brsBy[r.user_id] ||= []).push(r.branch_code);
  const managers = admin ? await db`SELECT id, name FROM users WHERE role = 'gestor' AND active ORDER BY name` : [];

  const branchesLabel = (u) => {
    if (u.role === "admin" || u.all_branches) return "Todas";
    const list = (brsBy[u.id] || []).sort((a, b) => a - b).map(branchName);
    return list.length ? list.join(", ") : <span className="chip missing">nenhuma</span>;
  };

  return (
    <Shell user={actor} active="admin">
      <div className="stack">
        <header className="page-head" style={{ marginBottom: 0 }}>
          <div>
            <div className="eyebrow">{admin ? "Administração" : "Minha equipe"}</div>
            <h1 style={{ marginTop: 10 }}>Usuários e permissões</h1>
            <p>
              {admin
                ? "Administrador gerencia todos. Gestor gerencia a própria equipe, liberando só o que ele mesmo tem."
                : "Você gerencia os usuários da sua equipe. Só é possível liberar módulos e filiais que você tem."}
            </p>
          </div>
        </header>
        {searchParams?.salvo ? (
          <div className="alert success" role="status">
            Alterações salvas.
          </div>
        ) : null}

        <div className="table-wrap" style={{ maxHeight: "none" }}>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Perfil</th>
                {admin ? <th>Gestor</th> : null}
                <th>Filiais</th>
                {MODULES.map((m) => (
                  <th key={m.id}>{m.name}</th>
                ))}
                <th>Último acesso</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <b style={{ fontWeight: 500 }}>{u.name}</b>{" "}
                    {!u.active ? <span className="chip missing">inativo</span> : null}
                    <br />
                    <span className="muted small">{u.email}</span>
                  </td>
                  <td>
                    <span className={`chip${u.role === "admin" ? " ok" : u.role === "gestor" ? " accent" : ""}`}>
                      {ROLES.find((r) => r.id === u.role)?.name || u.role}
                    </span>
                  </td>
                  {admin ? <td className="text-2">{u.manager_name || "—"}</td> : null}
                  <td className="text-2">
                    <span className="truncate" style={{ maxWidth: 220 }}>
                      {branchesLabel(u)}
                    </span>
                  </td>
                  {MODULES.map((m) => {
                    const l = u.role === "admin" ? "edit" : modsBy[u.id]?.[m.id];
                    return (
                      <td key={m.id}>{l ? LEVELS.find((x) => x.id === l)?.name : <span className="muted">—</span>}</td>
                    );
                  })}
                  <td className="muted mono small">{fmt(u.last_login_at)}</td>
                  <td>
                    {u.id !== actor.id ? (
                      <Link href={`/admin/usuarios/${u.id}`} className="btn secondary">
                        Editar
                      </Link>
                    ) : (
                      <span className="muted small">você</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 ? (
            <div className="empty">
              <b>Sua equipe ainda está vazia.</b>
              <span>Crie o primeiro usuário no formulário abaixo.</span>
            </div>
          ) : null}
        </div>

        <div className="panel stack">
          <h2>Novo usuário</h2>
          <UserForm
            action={createUserAction}
            actor={actor}
            modules={MODULES}
            levels={LEVELS}
            branches={BRANCHES}
            roles={ROLES}
            managers={managers}
            submitLabel="Criar usuário"
          />
        </div>
      </div>
    </Shell>
  );
}
