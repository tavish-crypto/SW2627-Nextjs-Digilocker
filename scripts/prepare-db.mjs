import { spawnSync } from "node:child_process";

// Vercel gets DATABASE_URL from project environment variables. Keep normal local
// builds fast/offline unless explicitly requested.
const shouldSync = process.env.VERCEL === "1" || process.env.SYNC_DB_ON_BUILD === "true";

if (!shouldSync) {
  console.log("[db] Skipping schema sync (set SYNC_DB_ON_BUILD=true to enable locally).");
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.error("[db] DATABASE_URL is required for deployment.");
  process.exit(1);
}

console.log("[db] Synchronizing Prisma schema before production build...");
const command = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(command, ["prisma", "db", "push", "--skip-generate"], {
  stdio: "inherit",
  env: process.env,
});

if (result.status !== 0) {
  console.error("[db] Prisma schema synchronization failed.");
  process.exit(result.status || 1);
}

console.log("[db] Database schema is ready.");
