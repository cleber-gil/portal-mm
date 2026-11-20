"use server";

import { redirect } from "next/navigation";
import { login, logout, hashPassword, userCount } from "@/lib/auth";
import { sql, ensureSchema } from "@/lib/db";

export async function loginAction(_prev, formData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "Informe e-mail e senha." };
  let ok = false;
  try {
    ok = await login(email, password);
  } catch (e) {
    return { error: e.message || "Erro ao entrar." };
  }
  if (!ok) return { error: "E-mail ou senha inválidos." };
  redirect("/");
}

export async function logoutAction() {
  logout();
  redirect("/login");
}

// cria o primeiro administrador; só funciona com o banco vazio
export async function setupAction(_prev, formData) {
  if ((await userCount()) > 0) redirect("/login");
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!name || !email) return { error: "Preencha nome e e-mail." };
  if (password.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };
  await ensureSchema();
  await sql()`INSERT INTO users (name, email, password_hash, is_admin, role, all_branches)
    VALUES (${name}, ${email}, ${await hashPassword(password)}, TRUE, 'admin', TRUE)`;
  await login(email, password);
  redirect("/");
}
