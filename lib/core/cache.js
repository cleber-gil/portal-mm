import { waitUntil } from "@vercel/functions";
import { sql, ensureSchema } from "./db";

// Cache persistente no banco com "stale-while-revalidate":
// - tem dado salvo: devolve na hora; se estiver velho, atualiza em segundo plano (uma atualização por vez)
// - não tem dado: busca agora (só a primeira vez é lenta)
const REFRESH_LOCK_MS = 6 * 60 * 1000; // uma atualização travada não bloqueia para sempre
const memory = new Map(); // evita reler o banco a cada requisição na mesma instância
const MEMORY_MS = 60 * 1000;

let tableReady = null;
function ensureTable() {
  if (!tableReady) {
    tableReady = (async () => {
      await ensureSchema();
      await sql()`CREATE TABLE IF NOT EXISTS data_cache (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        refreshing_at TIMESTAMPTZ
      )`;
    })().catch((e) => {
      tableReady = null;
      throw e;
    });
  }
  return tableReady;
}

async function save(key, value) {
  await sql()`INSERT INTO data_cache (key, value, updated_at, refreshing_at)
    VALUES (${key}, ${JSON.stringify(value)}, now(), NULL)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), refreshing_at = NULL`;
  memory.set(key, { value, updatedAt: Date.now(), expires: Date.now() + MEMORY_MS });
}

export async function getOrRefresh(key, maxAgeMs, fn) {
  const mem = memory.get(key);
  if (mem && mem.expires > Date.now() && Date.now() - mem.updatedAt < maxAgeMs) return mem.value;

  await ensureTable();
  const db = sql();
  const [row] = await db`SELECT value, updated_at, refreshing_at FROM data_cache WHERE key = ${key}`;
  if (!row) {
    const value = await fn();
    await save(key, value);
    return value;
  }

  const age = Date.now() - new Date(row.updated_at).getTime();
  if (age > maxAgeMs) {
    // trava atômica: só quem conseguir marcar refreshing_at dispara a atualização
    const locked = await db`UPDATE data_cache SET refreshing_at = now()
      WHERE key = ${key} AND (refreshing_at IS NULL OR refreshing_at < now() - ${`${REFRESH_LOCK_MS / 1000} seconds`}::interval)
      RETURNING key`;
    if (locked.length) {
      waitUntil(
        fn()
          .then((value) => save(key, value))
          .catch(() => db`UPDATE data_cache SET refreshing_at = NULL WHERE key = ${key}`)
      );
    }
  }
  memory.set(key, { value: row.value, updatedAt: new Date(row.updated_at).getTime(), expires: Date.now() + MEMORY_MS });
  return { ...row.value, refreshing: age > maxAgeMs };
}
