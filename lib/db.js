import { neon } from "@neondatabase/serverless";

let _sql = null;
export function sql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error("Banco não configurado (DATABASE_URL ausente).");
    _sql = neon(url);
  }
  return _sql;
}

let schemaReady = null;
// cria as tabelas na primeira chamada (idempotente)
export function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = sql();
      await db`CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        is_admin BOOLEAN NOT NULL DEFAULT FALSE,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_login_at TIMESTAMPTZ
      )`;
      await db`CREATE TABLE IF NOT EXISTS user_modules (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        module_id TEXT NOT NULL,
        level TEXT NOT NULL DEFAULT 'edit',
        PRIMARY KEY (user_id, module_id)
      )`;
      // hierarquia: perfil, gestor responsável e filiais
      await db`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'usuario'`;
      await db`ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL`;
      await db`ALTER TABLE users ADD COLUMN IF NOT EXISTS all_branches BOOLEAN NOT NULL DEFAULT FALSE`;
      // CPF da vendedora no CRM (define a carteira dela lá)
      await db`ALTER TABLE users ADD COLUMN IF NOT EXISTS crm_cpf TEXT`;
      await db`UPDATE users SET role = 'admin', all_branches = TRUE WHERE is_admin = TRUE AND role <> 'admin'`;
      await db`CREATE TABLE IF NOT EXISTS user_branches (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        branch_code INTEGER NOT NULL,
        PRIMARY KEY (user_id, branch_code)
      )`;
      await db`CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        module_id TEXT NOT NULL,
        action TEXT NOT NULL,
        payload JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    })().catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}

export async function audit(userId, moduleId, action, payload) {
  try {
    await ensureSchema();
    await sql()`INSERT INTO audit_log (user_id, module_id, action, payload)
      VALUES (${userId}, ${moduleId}, ${action}, ${JSON.stringify(payload ?? null)})`;
  } catch {
    // log de auditoria nunca derruba a operação principal
  }
}
