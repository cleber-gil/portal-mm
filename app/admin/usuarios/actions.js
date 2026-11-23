"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager, hashPassword } from "@/lib/core/auth";
import { sql, ensureSchema, audit } from "@/lib/core/db";
import { MODULES } from "@/lib/config/modules";
import { canManageTarget, isAdmin, sanitizeGrant } from "@/lib/core/access";

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
    crmCpf: cleanCpf(formData.get("crm_cpf")),
  };
}

// login aceita e-mail ou nome de usuário simples (letras, números, ponto, hífen, sublinhado)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,39}$/;
function loginError(login) {
  if (login.includes("@")) return EMAIL_RE.test(login) ? null : "E-mail inválido.";
  return USERNAME_RE.test(login)
    ? null
    : "Usuário inválido: use de 3 a 40 caracteres, só letras sem acento, números, ponto, hífen ou sublinhado.";
}

// CPF só com dígitos (11); vazio = sem vínculo com o CRM
function cleanCpf(v) {
  const d = String(v || "").replace(/\D/g, "");
  return d ? d.slice(-11).padStart(11, "0") : null;
}

function crmError(wanted, grant, login) {
  // o CRM identifica o usuário pelo e-mail no SSO
  if (grant.modules.crm && login && !login.includes("@")) {
    return "Para liberar o CRM, o login precisa ser um e-mail (o CRM identifica a pessoa por ele).";
  }
  if (grant.role === "usuario" && grant.modules.crm && !wanted.crmCpf) {
    return "Para liberar o CRM a um usuário, informe o CPF da vendedora (é ele que define a carteira).";
  }
  return null;
}

async function saveGrant(userId, grant) {
  const db = sql();
  await db`UPDATE users SET role = ${grant.role},
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
  if (!name || !email) return { error: "Preencha nome e usuário (ou e-mail)." };
  const loginErr = loginError(email);
  if (loginErr) return { error: loginErr };
  if (password.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };

  const wanted = readWanted(formData);
  const grant = sanitizeGrant(actor, wanted);
  if (!(await validManager(actor, grant))) return { error: "Escolha um gestor ativo como responsável." };
  const crmErr = crmError(wanted, grant, email);
  if (crmErr) return { error: crmErr };
  if (grant.role !== "admin" && !grant.allBranches && grant.branches.length === 0) {
    return { error: "Marque pelo menos uma filial (ou todas)." };
  }

  const db = sql();
  const [exists] = await db`SELECT id FROM users WHERE lower(email) = ${email}`;
  if (exists) return { error: "Já existe um usuário com esse login." };
  const [u] = await db`INSERT INTO users (name, email, password_hash)
    VALUES (${name}, ${email}, ${await hashPassword(password)}) RETURNING id`;
  await db`UPDATE users SET crm_cpf = ${wanted.crmCpf} WHERE id = ${u.id}`;
  await saveGrant(u.id, grant);
  await audit(actor.id, "admin", "criar_usuario", { userId: u.id, email, crmCpf: wanted.crmCpf, ...grant });
  revalidatePath("/admin/usuarios");
  return { ok: `Usuário ${name} criado.` };
}

export async function updateUserAction(_prev, formData) {
  const actor = await requireManager();
  await ensureSchema();
  const id = Number(formData.get("id"));
  const db = sql();
  const [target] = await db`SELECT id, email, role, manager_id FROM users WHERE id = ${id}`;
  if (!target) return { error: "Usuário não encontrado." };
  if (id === actor.id) return { error: "Para mudar o seu próprio acesso, peça a outro administrador." };
  if (!canManageTarget(actor, target)) return { error: "Este usuário não é da sua equipe." };

  const name = String(formData.get("name") || "").trim();
  const password = String(formData.get("password") || "");
  if (!name) return { error: "Informe o nome." };
  if (password && password.length < 8) return { error: "A nova senha precisa ter pelo menos 8 caracteres." };

  const wanted = readWanted(formData);
  const grant = sanitizeGrant(actor, wanted);
  if (!(await validManager(actor, grant))) return { error: "Escolha um gestor ativo como responsável." };
  const crmErr = crmError(wanted, grant, target.email);
  if (crmErr) return { error: crmErr };
  if (grant.role !== "admin" && !grant.allBranches && grant.branches.length === 0) {
    return { error: "Marque pelo menos uma filial (ou todas)." };
  }

  await db`UPDATE users SET name = ${name}, crm_cpf = ${wanted.crmCpf} WHERE id = ${id}`;
  if (password) await db`UPDATE users SET password_hash = ${await hashPassword(password)} WHERE id = ${id}`;
  await saveGrant(id, grant);
  // se deixou de ser gestor, a equipe dele fica sem responsável (volta para o admin)
  if (target.role === "gestor" && grant.role !== "gestor") {
    await db`UPDATE users SET manager_id = NULL WHERE manager_id = ${id}`;
  }
  await audit(actor.id, "admin", "alterar_usuario", { userId: id, senhaAlterada: !!password, crmCpf: wanted.crmCpf, ...grant });
  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios?salvo=1");
}

// confere se o ator pode mexer no alvo (não vale para si mesmo)
async function loadManageable(actor, id) {
  if (!id || id === actor.id) return { error: "Você não pode inativar nem excluir o seu próprio usuário." };
  const [target] = await sql()`SELECT id, name, email, role, manager_id, active FROM users WHERE id = ${id}`;
  if (!target) return { error: "Usuário não encontrado." };
  if (!canManageTarget(actor, target)) return { error: "Este usuário não é da sua equipe." };
  return { target };
}

// não deixa o portal ficar sem nenhum administrador ativo
async function isLastAdmin(target) {
  if (target.role !== "admin" || !target.active) return false;
  const [{ n }] = await sql()`SELECT count(*)::int AS n FROM users WHERE role = 'admin' AND active AND id <> ${target.id}`;
  return n === 0;
}

export async function setActiveAction(_prev, formData) {
  const actor = await requireManager();
  await ensureSchema();
  const id = Number(formData.get("id"));
  const active = formData.get("active") === "1";
  const { target, error } = await loadManageable(actor, id);
  if (error) return { error };
  if (!active && (await isLastAdmin(target))) return { error: "Este é o último administrador ativo." };
  await sql()`UPDATE users SET active = ${active} WHERE id = ${id}`;
  await audit(actor.id, "admin", active ? "reativar_usuario" : "inativar_usuario", { userId: id, email: target.email });
  revalidatePath("/admin/usuarios");
  revalidatePath(`/admin/usuarios/${id}`);
  return { ok: active ? "Usuário reativado." : "Usuário inativado. Ele não consegue mais entrar no portal." };
}

export async function deleteUserAction(_prev, formData) {
  const actor = await requireManager();
  await ensureSchema();
  const id = Number(formData.get("id"));
  const { target, error } = await loadManageable(actor, id);
  if (error) return { error };
  if (await isLastAdmin(target)) return { error: "Este é o último administrador ativo." };
  // módulos e filiais saem em cascata; equipe e log de auditoria ficam sem o vínculo (SET NULL)
  await sql()`DELETE FROM users WHERE id = ${id}`;
  await audit(actor.id, "admin", "excluir_usuario", { userId: id, name: target.name, email: target.email, role: target.role });
  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios?excluido=1");
}
