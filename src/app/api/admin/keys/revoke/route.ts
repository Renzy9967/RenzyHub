import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { query } from "@/lib/db";
import { z } from "zod";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = z.object({ id: z.string().uuid() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid key id." }, { status: 400 });

  await query(`UPDATE keys SET revoked_at = COALESCE(revoked_at, now()) WHERE id = $1`, [parsed.data.id]);
  return NextResponse.json({ ok: true });
}