import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { simpleRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await simpleRateLimit(`checkpoint-start:${ip}`, 30, 60);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const parsed = z.object({ systemId: z.string().uuid().optional() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  const system = parsed.data.systemId
    ? await query<{id:string}>(`SELECT id FROM key_systems WHERE id=$1 AND active=TRUE`, [parsed.data.systemId])
    : await query<{id:string}>(`SELECT id FROM key_systems WHERE name='RenzyHub' AND active=TRUE ORDER BY created_at LIMIT 1`);

  const systemId = system.rows[0]?.id;
  if (!systemId) return NextResponse.json({ error: "No active key system." }, { status: 404 });

  const cp = await query<{id:string;name:string;position:number;linkvertise_url:string}>(
    `SELECT id, name, position, linkvertise_url
     FROM checkpoints WHERE system_id=$1 AND enabled=TRUE ORDER BY position LIMIT 1`,
    [systemId]
  );
  if (!cp.rows[0]) return NextResponse.json({ error: "No checkpoints configured." }, { status: 500 });

  const session = await query<{id:string}>(
    `INSERT INTO checkpoint_sessions(system_id,current_position,expires_at)
     VALUES ($1,1,now() + interval '15 minutes')
     RETURNING id`,
    [systemId]
  );

  const total = await query<{count:string}>(
    `SELECT count(*)::text AS count FROM checkpoints WHERE system_id=$1 AND enabled=TRUE`,
    [systemId]
  );

  const url = new URL(cp.rows[0].linkvertise_url);
  url.searchParams.set("session", session.rows[0].id);
  url.searchParams.set("checkpoint", cp.rows[0].id);

  return NextResponse.json({
    sessionId: session.rows[0].id,
    checkpoint: {
      id: cp.rows[0].id,
      name: cp.rows[0].name,
      position: cp.rows[0].position,
      total: Number(total.rows[0].count),
      url: url.toString(),
    }
  });
}