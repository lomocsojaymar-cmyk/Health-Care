// Persistence: file-backed JSON store, serialised writes, ready to swap for Prisma/Postgres.
// The repository interface in this file mirrors the planned Prisma layer in docs/02.
import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { AuditLogEntry, Database, Patient, Provider } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "chas.json");

let writeChain: Promise<unknown> = Promise.resolve();

function defaultDb(): Database {
  return {
    patients: [],
    providers: [],
    availabilityTemplates: [],
    scheduleExceptions: [],
    appointments: [],
    statusHistory: [],
    auditLog: [],
  };
}

export function readDb(): Database {
  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    return { ...defaultDb(), ...(JSON.parse(raw) as Database) };
  } catch {
    // No file yet (fresh checkout or build-time prerender) — return empty db.
    return defaultDb();
  }
}

/**
 * Runs `fn` with exclusive access to the database and persists its return value.
 * Mutations are chained so concurrent server actions never clobber each other.
 */
export function withDb<T>(fn: (db: Database) => Promise<T> | T): Promise<T> {
  const run = writeChain.then(async () => {
    const db = readDb();
    const result = await fn(db);
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DB_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf8");
    fs.renameSync(tmp, DB_FILE);
    return result;
  });
  // Keep the chain alive even if a mutation fails.
  writeChain = run.catch(() => undefined);
  return run;
}

export function appendAudit(
  db: Database,
  entry: Omit<AuditLogEntry, "id" | "at">,
): void {
  db.auditLog.unshift({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    ...entry,
  });
  db.auditLog.length = Math.min(db.auditLog.length, 500);
}

// ---- Query helpers used by server components ----

export function getPatients(): Patient[] {
  return readDb().patients;
}

export function getProviders(): Provider[] {
  return readDb().providers;
}
