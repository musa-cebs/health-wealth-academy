import postgres from "postgres";

let sql: ReturnType<typeof postgres> | null = null;
/** Returns null when DATABASE_URL is not set, so callers can fall back gracefully. */
export function db() {
  if (!process.env.DATABASE_URL) return null;
  return (sql ??= postgres(process.env.DATABASE_URL, { ssl: "require", max: 3, idle_timeout: 20 }));
}
