"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, hashPassword } from "@/lib/auth";
import { sql, ensureSchema, audit } from "@/lib/db";
import { MODULES } from "@/lib/modules";

// lê do form os módulos marcados: campo "mod_<id>" com valor "", "view" ou "edit"
function readModules(formData) {
  const out = [];
  for (const m of MODULES) {
    const level = String(formData.get(`mod_${m.id}`) || "");
    if (level === "view" || level === "edit") out.push({ id: m.id, level });
  }
  return out;
}

async function saveModules(userId, modules) {
  const db = sql();
  await db`DELETE FROM user_modules WHERE user_id = ${userId}`;
  for (const m of modules) {
    await db`INSERT INTO user_modules (user_id, module_id, level) VALUES (${userId}, ${m.id}, ${m.level})`;
  }
}

export async function createUserAction(_prev, formData) {
  const admin = await requireAdmin();
  await ensureSchema();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const isAdmin = formData.get("is_admin") === "on";
  if (!name || !email) return { error: "Preencha nome e e-mail." };
  if (password.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };
  const db = sql();
  const [exists] = await db`SELECT id FROM users WHERE lower(email) = ${email}`;
  if (exists) return { error: "Já existe um usuário com esse e-mail." };
  const [u] = await db`INSERT INTO users (name, email, password_hash, is_admin)
    VALUES (${name}, ${email}, ${await hashPassword(password)}, ${isAdmin}) RETURNING id`;
  const modules = readModules(formData);
  await saveModules(u.id, modules);
  await audit(admin.id, "admin", "criar_usuario", { userId: u.id, email, isAdmin, modules });
  revalidatePath("/admin/usuarios");
  return { ok: `Usuário ${name} criado.` };
}

export async function updateUserAction(_prev, formData) {
  const admin = await requireAdmin();
  await ensureSchema();
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  const isAdmin = formData.get("is_admin") === "on";
  const active = formData.get("active") === "on";
  const password = String(formData.get("password") || "");
  if (!id || !name) return { error: "Dados inválidos." };
  if (id === admin.id && (!isAdmin || !active)) {
    return { error: "Você não pode tirar o seu próprio acesso de administrador nem se desativar." };
  }
  if (password && password.length < 8) return { error: "A nova senha precisa ter pelo menos 8 caracteres." };
  const db = sql();
  await db`UPDATE users SET name = ${name}, is_admin = ${isAdmin}, active = ${active} WHERE id = ${id}`;
  if (password) await db`UPDATE users SET password_hash = ${await hashPassword(password)} WHERE id = ${id}`;
  const modules = readModules(formData);
  await saveModules(id, modules);
  await audit(admin.id, "admin", "alterar_usuario", { userId: id, isAdmin, active, modules, senhaAlterada: !!password });
  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios?salvo=1");
}
