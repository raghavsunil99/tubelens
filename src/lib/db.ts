import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// SQLite through Node's built-in driver: no native module to compile and no
// service to run, so `npm install && npm run dev` is all a contributor needs.
// Migrations are plain SQL files in db/migrations, applied in filename order.

export type Db = DatabaseSync;

export function migrationsDir() {
  return path.join(process.cwd(), "db", "migrations");
}

export function migrate(db: Db, dir = migrationsDir()) {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  const applied = new Set(
    (db.prepare("SELECT name FROM schema_migrations").all() as { name: string }[]).map((r) => r.name),
  );
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    db.exec("BEGIN");
    try {
      db.exec(fs.readFileSync(path.join(dir, file), "utf8"));
      db.prepare("INSERT INTO schema_migrations (name, applied_at) VALUES (?, datetime('now'))").run(file);
      db.exec("COMMIT");
      ran.push(file);
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }
  return ran;
}

export function openDb(file: string): Db {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON");
  if (file !== ":memory:") db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 3000");
  migrate(db);
  return db;
}

export function databasePath() {
  return process.env.DATABASE_PATH || path.join(process.cwd(), "data", "tubelens.db");
}

// One connection per process, kept on globalThis so dev hot-reloads reuse it.
const holder = globalThis as unknown as { __tubelensDb?: Db };

export function getDb(): Db {
  holder.__tubelensDb ??= openDb(databasePath());
  return holder.__tubelensDb;
}

/** Test hook: swap in an in-memory database. */
export function setDbForTests(db: Db | undefined) {
  holder.__tubelensDb = db;
}

export function today(now = new Date()) {
  return now.toISOString().slice(0, 10);
}
