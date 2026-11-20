import { NextResponse } from "next/server";
import { createHmac, randomUUID } from "node:crypto";
import { currentUser, canAccess } from "@/lib/auth";
import { sql, audit } from "@/lib/db";

export const dynamic = "force-dynamic";

// Abre o CRM Vendas já logado: ticket assinado (HMAC) que vale 60 s e só pode ser usado uma vez.
// O CRM cria/atualiza o usuário dele a partir do ticket (perfil, filiais e CPF da vendedora).
const PERFIL = { admin: "admin", gestor: "gestor", usuario: "vendedora" };

export async function GET(req) {
  const base = new URL(req.url);
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/login", base));
  if (!canAccess(user, "crm")) return NextResponse.redirect(new URL("/?negado=crm", base));

  const secret = process.env.CRM_SSO_SECRET || "";
  const crmUrl = (process.env.CRM_URL || "https://cleber-gil-crm-vendas.vercel.app").replace(/\/$/, "");
  if (secret.length < 32) return new NextResponse("CRM_SSO_SECRET não configurado no portal.", { status: 500 });

  const [{ crm_cpf } = {}] = await sql()`SELECT crm_cpf FROM users WHERE id = ${user.id}`;
  const perfil = PERFIL[user.role] || "vendedora";
  if (perfil === "vendedora" && !crm_cpf) {
    return new NextResponse("Seu usuário não tem CPF de vendedora cadastrado. Peça ao seu gestor para preencher.", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const payload = {
    e: user.email.toLowerCase(),
    n: user.name,
    p: perfil,
    c: perfil === "vendedora" ? crm_cpf : null,
    // null = todas as filiais
    l: user.role === "admin" || user.all_branches ? null : user.branches,
    j: randomUUID(),
    exp: Date.now() + 60_000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  await audit(user.id, "crm", "abrir_crm", { perfil, lojas: payload.l });

  // no fragmento (#) o ticket não vai para logs de servidor nem para o Referer
  const res = NextResponse.redirect(`${crmUrl}/#sso=${body}.${sig}`, 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
