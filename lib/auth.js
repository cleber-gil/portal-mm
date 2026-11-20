import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { sql, ensureSchema } from "./db";
import { SESSION_COOKIE, SESSION_HOURS, signSession, verifySession } from "./session";
import { MODULES } from "./modules";

const DUMMY_HASH = bcrypt.hashSync("senha-inexistente", 10);

// usuário logado com permissões atuais (lidas do banco a cada request,
// então mudanças de permissão valem na hora)
export async function currentUser() {
  const uid = await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!uid) return null;
  await ensureSchema();
  const db = sql();
  const [user] = await db`SELECT id, name, email, is_admin, active FROM users WHERE id = ${uid}`;
  if (!user || !user.active) return null;
  const rows = await db`SELECT module_id, level FROM user_modules WHERE user_id = ${uid}`;
  const modules = {};
  if (user.is_admin) for (const m of MODULES) modules[m.id] = "edit";
  for (const r of rows) if (!user.is_admin) modules[r.module_id] = r.level;
  return { ...user, modules };
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export function canAccess(user, moduleId, level = "view") {
  const l = user?.modules?.[moduleId];
  if (!l) return false;
  return level === "view" ? true : l === "edit";
}

export async function requireModule(moduleId, level = "view") {
  const user = await requireUser();
  if (!canAccess(user, moduleId, level)) redirect("/?negado=" + moduleId);
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!user.is_admin) redirect("/?negado=admin");
  return user;
}

export async function hashPassword(pw) {
  return bcrypt.hash(pw, 10);
}

export async function login(email, password) {
  await ensureSchema();
  const db = sql();
  const [user] = await db`SELECT id, password_hash, active FROM users WHERE lower(email) = lower(${email})`;
  // compara mesmo sem usuário, pra não revelar quais e-mails existem pelo tempo de resposta
  const ok = await bcrypt.compare(password, user?.password_hash || DUMMY_HASH);
  if (!user || !ok || !user.active) return false;
  await db`UPDATE users SET last_login_at = now() WHERE id = ${user.id}`;
  cookies().set(SESSION_COOKIE, await signSession(user.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  return true;
}

export function logout() {
  cookies().delete(SESSION_COOKIE);
}

export async function userCount() {
  await ensureSchema();
  const [{ n }] = await sql()`SELECT count(*)::int AS n FROM users`;
  return n;
}
