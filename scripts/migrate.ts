import { databasePath, getDb } from "@/lib/db";

// Opening the database applies any pending migrations.
const db = getDb();
const rows = db.prepare("SELECT name, applied_at FROM schema_migrations ORDER BY name").all();
console.log(`Database: ${databasePath()}`);
for (const r of rows as { name: string; applied_at: string }[]) console.log(`  applied ${r.name} (${r.applied_at})`);
