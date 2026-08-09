import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { hashKey, randomKey } from "@/lib/security";
import { z } from "zod";

const schema = z.object({
  systemId: z.string().uuid(),
  durationSeconds: z.number().int().min(60).max(31536000),
});

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const systems = await query<{ id: string }>(`SELECT id FROM key_systems WHERE active = TRUE ORDER BY created_at LIMIT 1`);
  const systemId = systems.rows[0]?.id ?? "";

  const keys = await query(
    `SELECT id, key_prefix, created_at, expires_at, revoked_at
     FROM keys ORDER BY created_at DESC LIMIT 100`
  );

  return NextResponse.json({ systemId, keys: keys.rows });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  const system = await query(`SELECT id FROM key_systems WHERE id = $1 AND active = TRUE`, [parsed.data.systemId]);
  if (!system.rows[0]) return NextResponse.json({ error: "System not found." }, { status: 404 });

  const rawKey = randomKey();
  const hash = hashKey(rawKey);
  const expires = new Date(Date.now() + parsed.data.durationSeconds * 1000);

  await query(
    `INSERT INTO keys(system_id, key_hash, key_prefix, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [parsed.data.systemId, hash, rawKey.slice(0, 11), expires]
  );

  return NextResponse.json({ key: rawKey, expiresAt: expires.toISOString() });
}