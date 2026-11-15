// After `next build`, completes the standalone server folder so it can run on
// its own: static assets, public files and the SQL migrations the app reads at start-up.
import { cpSync, existsSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const out = join(root, ".next", "standalone");
if (!existsSync(join(out, "server.js"))) {
  console.error("No .next/standalone/server.js. Run `next build` first (next.config.ts sets output: standalone).");
  process.exit(1);
}
cpSync(join(root, ".next", "static"), join(out, ".next", "static"), { recursive: true });
if (existsSync(join(root, "public"))) cpSync(join(root, "public"), join(out, "public"), { recursive: true });
cpSync(join(root, "db"), join(out, "db"), { recursive: true });
// Local-only files that tracing can pull in. Keys and the database must never ship.
for (const f of [".env.local", ".env", "data", ".git"]) rmSync(join(out, f), { recursive: true, force: true });
// electron-builder silently drops any folder named node_modules from extra
// resources. Ship it as "modules"; the app links it back at start-up.
rmSync(join(out, "modules"), { recursive: true, force: true });
if (existsSync(join(out, "node_modules"))) renameSync(join(out, "node_modules"), join(out, "modules"));
console.log("Desktop server folder ready:", out);
