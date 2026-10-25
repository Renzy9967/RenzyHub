
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { hashKey, randomKey } from "@/lib/security";
import { z } from "zod";

const schema = z
  .object({
    systemId: z.string().uuid(),
    lifetime: z.boolean().optional().default(false),
    durationSeconds: z
      .number()
      .int()
      .min(60)
      .max(31536000)
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (
      !data.lifetime &&
      (typeof data.durationSeconds !== "number" ||
        data.durationSeconds < 60 ||
        data.durationSeconds > 31536000)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["durationSeconds"],
        message: "Duration must be between 60 and 31536000 seconds.",
      });
    }
  });

export async function GET() {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const systems = await query<{ id: string }>(
    `SELECT id
     FROM key_systems
     WHERE active = TRUE
     ORDER BY created_at
     LIMIT 1`
  );

  const systemId = systems.rows[0]?.id ?? "";

  const keys = await query(
    `SELECT id, key_prefix, created_at, expires_at, revoked_at
     FROM keys
     ORDER BY created_at DESC
     LIMIT 100`
  );

  return NextResponse.json({
    systemId,
    keys: keys.rows,
  });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const parsed = schema.safeParse(
    await req.json().catch(() => null)
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input." },
      { status: 400 }
    );
  }

  const { systemId, lifetime, durationSeconds } = parsed.data;

  const system = await query(
    `SELECT id
     FROM key_systems
     WHERE id = $1 AND active = TRUE`,
    [systemId]
  );

  if (!system.rows[0]) {
    return NextResponse.json(
      { error: "System not found." },
      { status: 404 }
    );
  }

  const rawKey = randomKey();
  const hash = hashKey(rawKey);

  const expires = lifetime
    ? null
    : new Date(
        Date.now() + durationSeconds! * 1000
      );

  await query(
    `INSERT INTO keys (
       system_id,
       key_hash,
       key_prefix,
       expires_at
     )
     VALUES ($1, $2, $3, $4)`,
    [
      systemId,
      hash,
      rawKey.slice(0, 11),
      expires,
    ]
  );

  return NextResponse.json({
    key: rawKey,
    lifetime,
    expiresAt: expires?.toISOString() ?? null,
  });
}
