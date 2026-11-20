"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager, hashPassword } from "@/lib/auth";
import { sql, ensureSchema, audit } from "@/lib/db";
import { MODULES } from "@/lib/modules";
import { canManageTarget, isAdmin, sanitizeGrant } from "@/lib/access";

// lê do formulário o que foi pedido; o que vale é o resultado de sanitizeGrant
function readWanted(formData) {
  const modules = {};
  for (const m of MODULES) {
    const level = String(formData.get(`mod_${m.id}`) || "");
    if (level) modules[m.id] = level;
  }
  return {
    role: String(formData.get("role") || "usuario"),
    managerId: formData.get("manager_id") ? Number(formData.get("manager_id")) : null,
    allBranches: formData.get("all_branches") === "on",
    branches: formData.getAll("branches").map(Number),
    modules,
  };
}

async function saveGrant(userId, grant) {
  const db = sql();
  await db`UPDATE users SET role = ${grant.role}, is_admin = ${grant.role === "admin"},
    manager_id = ${grant.managerId}, all_branches = ${grant.allBranches} WHERE id = ${userId}`;
  await db`DELETE FROM user_modules WHERE user_id = ${userId}`;
  for (const [id, level] of Object.entries(grant.modules)) {
    await db`INSERT INTO user_modules (user_id, module_id, level) VALUES (${userId}, ${id}, ${level})`;
  }
  await db`DELETE FROM user_branches WHERE user_id = ${userId}`;
  for (const code of grant.branches) {
    await db`INSERT INTO user_branches (user_id, branch_code) VALUES (${userId}, ${code})`;
  }
}

async function validManager(actor, grant) {
  if (!isAdmin(actor) || !grant.managerId) return true;
  const [m] = await sql()`SELECT role, active FROM users WHERE id = ${grant.managerId}`;
  return !!m && m.role === "gestor" && m.active;
}

export async function createUserAction(_prev, formData) {
  const actor = await requireManager();
  await ensureSchema();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!name || !email) return { error: "Preencha nome e e-mail." };
  if (password.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };

  const grant = sanitizeGrant(actor, readWanted(formData));
  if (!(await validManager(actor, grant))) return { error: "Escolha um gestor ativo como responsável." };
  if (grant.role !== "admin" && !grant.allBranches && grant.branches.length === 0) {
    return { error: "Marque pelo menos uma filial (ou todas)." };
  }

  const db = sql();
  const [exists] = await db`SELECT id FROM users WHERE lower(email) = ${email}`;
  if (exists) return { error: "Já existe um usuário com esse e-mail." };
  const [u] = await db`INSERT INTO users (name, email, password_hash)
    VALUES (${name}, ${email}, ${await hashPassword(password)}) RETURNING id`;
  await saveGrant(u.id, grant);
  await audit(actor.id, "admin", "criar_usuario", { userId: u.id, email, ...grant });
  revalidatePath("/admin/usuarios");
  return { ok: `Usuário ${name} criado.` };
}

export async function updateUserAction(_prev, formData) {
  const actor = await requireManager();
  await ensureSchema();
  const id = Number(formData.get("id"));
  const db = sql();
  const [target] = await db`SELECT id, role, manager_id FROM users WHERE id = ${id}`;
  if (!target) return { error: "Usuário não encontrado." };
  if (id === actor.id) return { error: "Para mudar o seu próprio acesso, peça a outro administrador." };
  if (!canManageTarget(actor, target)) return { error: "Este usuário não é da sua equipe." };

  const name = String(formData.get("name") || "").trim();
  const active = formData.get("active") === "on";
  const password = String(formData.get("password") || "");
  if (!name) return { error: "Informe o nome." };
  if (password && password.length < 8) return { error: "A nova senha precisa ter pelo menos 8 caracteres." };

  const grant = sanitizeGrant(actor, readWanted(formData));
  if (!(await validManager(actor, grant))) return { error: "Escolha um gestor ativo como responsável." };
  if (grant.role !== "admin" && !grant.allBranches && grant.branches.length === 0) {
    return { error: "Marque pelo menos uma filial (ou todas)." };
  }

  await db`UPDATE users SET name = ${name}, active = ${active} WHERE id = ${id}`;
  if (password) await db`UPDATE users SET password_hash = ${await hashPassword(password)} WHERE id = ${id}`;
  await saveGrant(id, grant);
  // se deixou de ser gestor, a equipe dele fica sem responsável (volta para o admin)
  if (target.role === "gestor" && grant.role !== "gestor") {
    await db`UPDATE users SET manager_id = NULL WHERE manager_id = ${id}`;
  }
  await audit(actor.id, "admin", "alterar_usuario", { userId: id, active, senhaAlterada: !!password, ...grant });
  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios?salvo=1");
}
