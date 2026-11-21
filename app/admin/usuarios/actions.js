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

// CPF só com dígitos (11); vazio = sem vínculo com o CRM; "" inválido = false
function cleanCpf(v) {
  const d = String(v || "").replace(/\D/g, "");
  if (!d) return null;
  return validCpf(d) ? d : false;
}

function validCpf(d) {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (len) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

// O CPF define a carteira da vendedora no CRM: só o administrador vincula ou troca.
// Gestor pode liberar o módulo; a vendedora só abre o CRM depois que o admin vincular o CPF.
async function resolveCrmCpf(actor, wanted, grant, targetId, currentCpf) {
  if (!isAdmin(actor)) return { cpf: currentCpf ?? null };
  if (wanted.crmCpf === false) return { error: "CPF da vendedora inválido." };
  const cpf = grant.role === "usuario" ? wanted.crmCpf : null;
  if (grant.role === "usuario" && grant.modules.crm && !cpf) {
    return { error: "Para liberar o CRM a um usuário, informe o CPF da vendedora (é ele que define a carteira)." };
  }
  if (cpf) {
    const [dup] = await sql()`SELECT name FROM users WHERE crm_cpf = ${cpf} AND id IS DISTINCT FROM ${targetId}`;
    if (dup) return { error: `Esse CPF já está vinculado a ${dup.name}.` };
  }
  return { cpf };
}

// no log de auditoria só os 3 últimos dígitos (LGPD: minimização)
const maskCpf = (c) => (c ? `***.***.*${c.slice(-3, -2)}-${c.slice(-2)}` : null);

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
  if (!name || !email) return { error: "Preencha nome e e-mail." };
  if (password.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };

  const wanted = readWanted(formData);
  const grant = sanitizeGrant(actor, wanted);
  if (!(await validManager(actor, grant))) return { error: "Escolha um gestor ativo como responsável." };
  const crm = await resolveCrmCpf(actor, wanted, grant, null, null);
  if (crm.error) return { error: crm.error };
  if (grant.role !== "admin" && !grant.allBranches && grant.branches.length === 0) {
    return { error: "Marque pelo menos uma filial (ou todas)." };
  }

  const db = sql();
  const [exists] = await db`SELECT id FROM users WHERE lower(email) = ${email}`;
  if (exists) return { error: "Já existe um usuário com esse e-mail." };
  const [u] = await db`INSERT INTO users (name, email, password_hash)
    VALUES (${name}, ${email}, ${await hashPassword(password)}) RETURNING id`;
  await db`UPDATE users SET crm_cpf = ${crm.cpf} WHERE id = ${u.id}`;
  await saveGrant(u.id, grant);
  await audit(actor.id, "admin", "criar_usuario", { userId: u.id, email, crmCpf: maskCpf(crm.cpf), ...grant });
  revalidatePath("/admin/usuarios");
  return { ok: `Usuário ${name} criado.` };
}

export async function updateUserAction(_prev, formData) {
  const actor = await requireManager();
  await ensureSchema();
  const id = Number(formData.get("id"));
  const db = sql();
  const [target] = await db`SELECT id, role, manager_id, crm_cpf FROM users WHERE id = ${id}`;
  if (!target) return { error: "Usuário não encontrado." };
  if (id === actor.id) return { error: "Para mudar o seu próprio acesso, peça a outro administrador." };
  if (!canManageTarget(actor, target)) return { error: "Este usuário não é da sua equipe." };

  const name = String(formData.get("name") || "").trim();
  const active = formData.get("active") === "on";
  const password = String(formData.get("password") || "");
  if (!name) return { error: "Informe o nome." };
  if (password && password.length < 8) return { error: "A nova senha precisa ter pelo menos 8 caracteres." };

  const wanted = readWanted(formData);
  const grant = sanitizeGrant(actor, wanted);
  if (!(await validManager(actor, grant))) return { error: "Escolha um gestor ativo como responsável." };
  const crm = await resolveCrmCpf(actor, wanted, grant, id, target.crm_cpf);
  if (crm.error) return { error: crm.error };
  if (grant.role !== "admin" && !grant.allBranches && grant.branches.length === 0) {
    return { error: "Marque pelo menos uma filial (ou todas)." };
  }

  await db`UPDATE users SET name = ${name}, active = ${active}, crm_cpf = ${crm.cpf} WHERE id = ${id}`;
  if (password) await db`UPDATE users SET password_hash = ${await hashPassword(password)} WHERE id = ${id}`;
  await saveGrant(id, grant);
  // se deixou de ser gestor, a equipe dele fica sem responsável (volta para o admin)
  if (target.role === "gestor" && grant.role !== "gestor") {
    await db`UPDATE users SET manager_id = NULL WHERE manager_id = ${id}`;
  }
  await audit(actor.id, "admin", "alterar_usuario", { userId: id, active, senhaAlterada: !!password, crmCpf: maskCpf(crm.cpf), ...grant });
  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios?salvo=1");
}
