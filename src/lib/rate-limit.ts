import { query } from "./db";

export async function simpleRateLimit(
  bucket: string,
  limit = 20,
  windowSeconds = 60
) {
  const now = new Date();
  const result = await query<{ count: number; reset_at: Date }>(
    `SELECT count, reset_at FROM rate_limits WHERE bucket = $1`,
    [bucket]
  );

  if (!result.rows[0] || result.rows[0].reset_at <= now) {
    await query(
      `INSERT INTO rate_limits(bucket, count, reset_at)
       VALUES ($1, 1, now() + ($2 || ' seconds')::interval)
       ON CONFLICT(bucket)
       DO UPDATE SET count = 1, reset_at = EXCLUDED.reset_at`,
      [bucket, windowSeconds]
    );
    return { allowed: true, remaining: limit - 1 };
  }

  if (result.rows[0].count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  await query(`UPDATE rate_limits SET count = count + 1 WHERE bucket = $1`, [bucket]);
  return { allowed: true, remaining: limit - result.rows[0].count - 1 };
}