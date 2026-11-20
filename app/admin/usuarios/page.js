import Link from "next/link";
import Shell from "../../_components/Shell";
import UserForm from "./UserForm";
import { createUserAction } from "./actions";
import { requireAdmin } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import { MODULES, LEVELS } from "@/lib/modules";

export const dynamic = "force-dynamic";

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export const metadata = { title: "Usuários" };

function fmt(d) {
  return d ? DATE_FMT.format(new Date(d)) : "—";
}

export default async function UsersPage({ searchParams }) {
  const admin = await requireAdmin();
  await ensureSchema();
  const db = sql();
  const users = await db`SELECT id, name, email, is_admin, active, last_login_at FROM users ORDER BY name`;
  const mods = await db`SELECT user_id, module_id, level FROM user_modules`;
  const byUser = {};
  for (const r of mods) (byUser[r.user_id] ||= {})[r.module_id] = r.level;

  return (
    <Shell user={admin} active="admin">
      <div className="stack">
        <header className="page-head" style={{ marginBottom: 0 }}>
          <div>
            <div className="eyebrow">Administração</div>
            <h1 style={{ marginTop: 10 }}>Usuários e permissões</h1>
            <p>Cada usuário vê só os módulos liberados. Administrador vê tudo.</p>
          </div>
        </header>
        {searchParams?.salvo ? <div className="alert success">Alterações salvas.</div> : null}

        <div className="table-wrap" style={{ maxHeight: "none" }}>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Perfil</th>
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
                    {u.name} {!u.active ? <span className="chip missing">inativo</span> : null}
                  </td>
                  <td>{u.email}</td>
                  <td>{u.is_admin ? <span className="chip ok">Admin</span> : "Usuário"}</td>
                  {MODULES.map((m) => {
                    const l = u.is_admin ? "edit" : byUser[u.id]?.[m.id];
                    return <td key={m.id}>{l ? LEVELS.find((x) => x.id === l)?.name : <span className="muted">—</span>}</td>;
                  })}
                  <td className="muted mono small">{fmt(u.last_login_at)}</td>
                  <td>
                    <Link href={`/admin/usuarios/${u.id}`} className="btn secondary">
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel stack">
          <h2>Novo usuário</h2>
          <UserForm action={createUserAction} modules={MODULES} levels={LEVELS} submitLabel="Criar usuário" />
        </div>
      </div>
    </Shell>
  );
}
