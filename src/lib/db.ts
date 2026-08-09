import { Pool, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __renzyhubPool: Pool | undefined;
}

export const db =
  global.__renzyhubPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
  });

if (process.env.NODE_ENV !== "production") {
  global.__renzyhubPool = db;
}

export async function query<T extends QueryResultRow>(
  text: string,
  values: unknown[] = []
) {
  return db.query<T>(text, values);
}