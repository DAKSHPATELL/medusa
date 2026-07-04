import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

/** Walk up from cwd until we find pnpm-workspace.yaml (the repo root). */
function findRepoRoot(startDir: string = process.cwd()): string {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

export function repoRoot(): string {
  return findRepoRoot();
}

declare global {
  var __clearborderDb: Database.Database | undefined;
}

/** Shared SQLite handle (WAL) — same file the agent service uses. */
export function db(): Database.Database {
  if (!globalThis.__clearborderDb) {
    const dir = path.join(findRepoRoot(), "data");
    fs.mkdirSync(dir, { recursive: true });
    const handle = new Database(path.join(dir, "clearborder.db"));
    handle.pragma("journal_mode = WAL");
    handle.pragma("busy_timeout = 5000");
    globalThis.__clearborderDb = handle;
  }
  return globalThis.__clearborderDb;
}
