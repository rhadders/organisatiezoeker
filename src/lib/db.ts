import "server-only";
import { Pool, type QueryResultRow } from "pg";

import { env } from "@/lib/env";

/*
 * Eén pool voor de hele app. De rol is postgres (bypasst RLS); de grens is de
 * sessiecontrole in proxy.ts plus requireUser() in elke actie en pagina.
 */
const globalForPg = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: env.DATABASE_URL,
    max: 8,
    idleTimeoutMillis: 30_000,
  });
if (process.env.NODE_ENV !== "production") globalForPg.pgPool = pool;

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

export async function one<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
