
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { hashKey } from "@/lib/security";
import { simpleRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const rl = await simpleRateLimit(`key-validate:${ip}`, 60, 60);

  if (!rl.allowed) {
    return NextResponse.json(
      { valid: false, reason: "rate_limited" },
      { status: 429 }
    );
  }

  const parsed = z
    .object({ key: z.string().min(10).max(100) })
    .safeParse(await req.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { valid: false, reason: "invalid_format" },
      { status: 400 }
    );
  }

  const keyHash = hashKey(parsed.data.key);

  const result = await query<{
    expires_at: Date | null;
    revoked_at: Date | null;
    system_id: string;
  }>(
    `SELECT expires_at, revoked_at, system_id
     FROM keys
     WHERE key_hash = $1
     LIMIT 1`,
    [keyHash]
  );

  const key = result.rows[0];

  if (!key) {
    return NextResponse.json({
      valid: false,
      reason: "not_found",
    });
  }

  if (key.revoked_at) {
    return NextResponse.json({
      valid: false,
      reason: "revoked",
    });
  }

  // NULL expires_at berarti Lifetime Key.
  if (key.expires_at !== null && new Date(key.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({
      valid: false,
      reason: "expired",
      expiresAt: new Date(key.expires_at).toISOString(),
    });
  }

  await query(
    `UPDATE keys
     SET last_validated_at = now()
     WHERE key_hash = $1`,
    [keyHash]
  );

  const isLifetime = key.expires_at === null;
  const expiresAt = isLifetime
    ? null
    : new Date(key.expires_at!).toISOString();

  return NextResponse.json({
    valid: true,
    lifetime: isLifetime,
    expiresAt,
    remainingSeconds: isLifetime
      ? null
      : Math.max(
          0,
          Math.floor(
            (new Date(key.expires_at!).getTime() - Date.now()) / 1000
          )
        ),
    systemId: key.system_id,
  });
}
