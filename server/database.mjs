import { mkdir, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import lockfile from "proper-lockfile";

export async function connectDatabase({
  url = process.env.DATABASE_URL,
  migrations = new URL("../db/migrations/", import.meta.url),
  directory = process.env.DATABASE_DIR || "runtime/database",
  memory = process.env.DATABASE_MEMORY === "1",
} = {}) {
  let db, release;
  if (url) {
    const pool = new pg.Pool({
      connectionString: url,
      max: 4,
      connectionTimeoutMillis: 5000,
    });
    db = {
      mode: "postgresql",
      query: (...args) => pool.query(...args),
      close: () => pool.end(),
      async transaction(fn) {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const result = await fn(client);
          await client.query("COMMIT");
          return result;
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      },
    };
  } else {
    const location = resolve(directory);
    if (!memory) {
      await mkdir(location, { recursive: true });
      release = await lockfile.lock(location, { retries: 0, stale: 30000 });
    }
    try {
      const embedded = new PGlite(memory ? undefined : location);
      await embedded.waitReady;
      db = {
        mode: "pglite",
        query: (...args) => embedded.query(...args),
        transaction: (fn) => embedded.transaction(fn),
        async close() {
          await embedded.close();
          await release?.();
        },
      };
    } catch (error) {
      await release?.();
      throw error;
    }
  }
  try {
    await migrate(db, migrations);
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}

async function migrate(db, folder) {
  await db.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  for (const name of (await readdir(folder))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(new URL(name, folder), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    await db.transaction(async (tx) => {
      await tx.query("LOCK TABLE schema_migrations IN EXCLUSIVE MODE");
      const existing = (
        await tx.query("SELECT checksum FROM schema_migrations WHERE name=$1", [
          name,
        ])
      ).rows[0];
      if (existing) {
        if (existing.checksum !== checksum)
          throw new Error(`Applied migration changed: ${name}`);
        return;
      }
      // Migrations contain only ordinary SQL; no procedural blocks or semicolons in literals.
      for (const statement of sql
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean))
        await tx.query(statement);
      await tx.query(
        "INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)",
        [name, checksum],
      );
    });
  }
}
