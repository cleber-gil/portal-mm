import Link from "next/link";
import { notFound } from "next/navigation";
import Shell from "../../../_components/Shell";
import UserForm from "../UserForm";
import { Icon } from "../../../_components/icons";
import { updateUserAction } from "../actions";
import { requireAdmin } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";
import { MODULES, LEVELS } from "@/lib/modules";

export const dynamic = "force-dynamic";

export default async function EditUserPage({ params }) {
  const admin = await requireAdmin();
  await ensureSchema();
  const db = sql();
  const id = Number(params.id);
  const [u] = await db`SELECT id, name, email, is_admin, active FROM users WHERE id = ${id}`;
  if (!u) notFound();
  const rows = await db`SELECT module_id, level FROM user_modules WHERE user_id = ${id}`;
  const modules = Object.fromEntries(rows.map((r) => [r.module_id, r.level]));

  return (
    <Shell user={admin} active="admin">
      <div className="stack">
        <div>
          <Link href="/admin/usuarios" className="btn ghost" style={{ paddingLeft: 0 }}>
            <Icon name="voltar" size={16} /> Usuários
          </Link>
          <h1 style={{ marginTop: 8 }}>{u.name}</h1>
          <p className="text-2" style={{ marginTop: 4 }}>{u.email}</p>
        </div>
        <div className="panel">
          <UserForm
            action={updateUserAction}
            modules={MODULES}
            levels={LEVELS}
            user={{ ...u, modules }}
            submitLabel="Salvar"
          />
        </div>
      </div>
    </Shell>
  );
}
