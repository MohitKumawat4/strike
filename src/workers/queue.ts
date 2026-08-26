import { PgBoss } from "pg-boss";

/** PostgreSQL-backed background queue; use the Supabase pooled DATABASE_URL. */
export function createProcessingQueue(connectionString: string) {
  return new PgBoss({ connectionString });
}
