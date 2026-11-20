import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Shell from "../../../_components/Shell";
import UserForm from "../UserForm";
import { Icon } from "../../../_components/icons";
import { updateUserAction } from "../actions";
import { requireManager } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import { MODULES, LEVELS } from "@/lib/modules";
import { BRANCHES, ROLES } from "@/lib/branches";
import { canManageTarget } from "@/lib/access";

export const dynamic = "force-dynamic";
export const metadata = { title: "Editar usuário" };

export default async function EditUserPage({ params }) {
  const actor = await requireManager();
  await ensureSchema();
  const db = sql();
  const id = Number(params.id);
  if (id === actor.id) redirect("/admin/usuarios");
  const [u] = await db`SELECT id, name, email, role, manager_id, all_branches, active FROM users WHERE id = ${id}`;
  if (!u || !canManageTarget(actor, u)) notFound();
  const rows = await db`SELECT module_id, level FROM user_modules WHERE user_id = ${id}`;
  const modules = Object.fromEntries(rows.map((r) => [r.module_id, r.level]));
  const branches = (await db`SELECT branch_code FROM user_branches WHERE user_id = ${id}`).map((r) => r.branch_code);
  const managers =
    actor.role === "admin"
      ? await db`SELECT id, name FROM users WHERE role = 'gestor' AND active AND id <> ${id} ORDER BY name`
      : [];

  return (
    <Shell user={actor} active="admin">
      <div className="stack">
        <div>
          <Link href="/admin/usuarios" className="btn ghost" style={{ paddingLeft: 0 }}>
            <Icon name="voltar" size={16} /> Usuários
          </Link>
          <h1 style={{ marginTop: 8 }}>{u.name}</h1>
          <p className="text-2" style={{ marginTop: 4 }}>
            {u.email}
          </p>
        </div>
        <div className="panel">
          <UserForm
            action={updateUserAction}
            actor={actor}
            modules={MODULES}
            levels={LEVELS}
            branches={BRANCHES}
            roles={ROLES}
            managers={managers}
            user={{ ...u, modules, branches }}
            submitLabel="Salvar"
          />
        </div>
      </div>
    </Shell>
  );
}
