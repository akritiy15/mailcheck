import mysql, { Pool, RowDataPacket } from "mysql2/promise";
import type { VerifyResult } from "./verify";

// Reuse one pool across hot reloads in dev.
const g = globalThis as unknown as { __mailcheckPool?: Pool; __mailcheckReady?: Promise<void> };

export function isDbEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function getPool(): Pool {
  if (!g.__mailcheckPool) {
    g.__mailcheckPool = mysql.createPool({ uri: process.env.DATABASE_URL!, connectionLimit: 5 });
  }
  return g.__mailcheckPool;
}

/** Creates the table on first use so a fresh database works with zero setup. */
function ensureSchema(): Promise<void> {
  if (!g.__mailcheckReady) {
    g.__mailcheckReady = getPool()
      .query(
        `CREATE TABLE IF NOT EXISTS verifications (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          email VARCHAR(254) NOT NULL,
          domain VARCHAR(253) NOT NULL,
          verdict ENUM('deliverable','risky','undeliverable') NOT NULL,
          score TINYINT UNSIGNED NOT NULL,
          reason VARCHAR(255) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_verifications_created (created_at),
          INDEX idx_verifications_domain (domain)
        ) ENGINE=InnoDB`
      )
      .then(() => undefined)
      .catch((err) => {
        g.__mailcheckReady = undefined; // retry next time
        throw err;
      });
  }
  return g.__mailcheckReady;
}

/** Best-effort: a database outage must never break verification itself. */
export async function saveResults(results: VerifyResult[]): Promise<void> {
  if (!isDbEnabled() || results.length === 0) return;
  try {
    await ensureSchema();
    const rows = results.map((r) => [
      r.email,
      r.email.split("@")[1] ?? "",
      r.verdict,
      r.score,
      r.reason.slice(0, 255),
    ]);
    await getPool().query("INSERT INTO verifications (email, domain, verdict, score, reason) VALUES ?", [rows]);
  } catch (err) {
    console.error("[mailcheck] could not save history:", (err as Error).message);
  }
}

export interface HistoryItem {
  id: number;
  email: string;
  verdict: string;
  score: number;
  reason: string;
  createdAt: string;
}

export async function getHistory(limit: number): Promise<HistoryItem[]> {
  await ensureSchema();
  const [rows] = await getPool().query<RowDataPacket[]>(
    "SELECT id, email, verdict, score, reason, created_at FROM verifications ORDER BY id DESC LIMIT ?",
    [limit]
  );
  return rows.map((r) => ({
    id: Number(r.id),
    email: r.email,
    verdict: r.verdict,
    score: r.score,
    reason: r.reason,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}
