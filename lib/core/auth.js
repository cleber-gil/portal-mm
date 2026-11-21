import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { sql, ensureSchema } from "./db";
import { SESSION_COOKIE, SESSION_HOURS, signSession, verifySession } from "./session";
import { MODULES } from "../config/modules";

const DUMMY_HASH = bcrypt.hashSync("senha-inexistente", 10);

// usuário logado com permissões atuais (lidas do banco a cada request,
// então mudanças de permissão valem na hora)
export async function currentUser() {
  const uid = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!uid) return null;
  await ensureSchema();
  const db = sql();
  const [user] = await db`SELECT id, name, email, role, manager_id, all_branches, active FROM users WHERE id = ${uid}`;
  if (!user || !user.active) return null;
  const admin = user.role === "admin";
  const modules = {};
  if (admin) {
    for (const m of MODULES) modules[m.id] = "edit";
  } else {
    const rows = await db`SELECT module_id, level FROM user_modules WHERE user_id = ${uid}`;
    for (const r of rows) modules[r.module_id] = r.level;
  }
  const branches = admin || user.all_branches
    ? []
    : (await db`SELECT branch_code FROM user_branches WHERE user_id = ${uid} ORDER BY branch_code`).map((r) => r.branch_code);
  return { ...user, modules, branches };
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
  if (user.role !== "admin") redirect("/?negado=admin");
  return user;
}

// admin ou gestor
export async function requireManager() {
  const user = await requireUser();
  if (user.role !== "admin" && user.role !== "gestor") redirect("/?negado=admin");
  return user;
}

export async function hashPassword(pw) {
  return bcrypt.hash(pw, 10);
}

// Rate limit do login: falhas nos últimos 15 min.
// Por e-mail trava força bruta numa conta; por IP trava quem testa várias contas.
const LOCK_WINDOW = "15 minutes";
const MAX_FAILS_EMAIL = 5;
const MAX_FAILS_IP = 20;

export class LoginLockedError extends Error {
  constructor() {
    super("Muitas tentativas sem sucesso. Aguarde 15 minutos e tente de novo.");
  }
}

async function clientIp() {
  const h = await headers();
  // na Vercel o primeiro IP do x-forwarded-for é o do cliente (definido pela própria Vercel)
  return (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || null;
}

export async function login(email, password) {
  await ensureSchema();
  const db = sql();
  const key = String(email).toLowerCase();
  const ip = await clientIp();

  const [{ byEmail, byIp }] = await db`SELECT
      count(*) FILTER (WHERE email = ${key})::int AS "byEmail",
      count(*) FILTER (WHERE ${ip}::text IS NOT NULL AND ip = ${ip})::int AS "byIp"
    FROM login_failures
    WHERE created_at > now() - ${LOCK_WINDOW}::interval AND (email = ${key} OR ip = ${ip})`;
  if (byEmail >= MAX_FAILS_EMAIL || byIp >= MAX_FAILS_IP) throw new LoginLockedError();

  const [user] = await db`SELECT id, password_hash, active FROM users WHERE lower(email) = ${key}`;
  // compara mesmo sem usuário, pra não revelar quais e-mails existem pelo tempo de resposta
  const ok = await bcrypt.compare(password, user?.password_hash || DUMMY_HASH);
  if (!user || !ok || !user.active) {
    await db`INSERT INTO login_failures (email, ip) VALUES (${key}, ${ip})`;
    // faxina ocasional: o que passou da janela não serve mais
    if (Math.random() < 0.05) await db`DELETE FROM login_failures WHERE created_at < now() - interval '1 day'`;
    return false;
  }
  await db`DELETE FROM login_failures WHERE email = ${key}`;
  await db`UPDATE users SET last_login_at = now() WHERE id = ${user.id}`;
  (await cookies()).set(SESSION_COOKIE, await signSession(user.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  return true;
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function userCount() {
  await ensureSchema();
  const [{ n }] = await sql()`SELECT count(*)::int AS n FROM users`;
  return n;
}
