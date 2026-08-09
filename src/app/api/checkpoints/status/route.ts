import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { z } from "zod";
import { hashKey, randomKey } from "@/lib/security";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = z.string().uuid().safeParse(url.searchParams.get("session"));
  if (!parsed.success) return NextResponse.json({ error: "Invalid session." }, { status: 400 });

  const session = await query<{id:string;system_id:string;current_position:number;expires_at:Date;completed_at:Date|null}>(
    `SELECT id, system_id, current_position, expires_at, completed_at
     FROM checkpoint_sessions WHERE id=$1 LIMIT 1`, [parsed.data]
  );
  const s = session.rows[0];
  if (!s || s.expires_at <= new Date()) return NextResponse.json({ error: "Session expired." }, { status: 410 });

  if (s.completed_at) return NextResponse.json({ error: "Already completed." }, { status: 409 });

  const cp = await query<{id:string;name:string;position:number;linkvertise_url:string}>(
    `SELECT id,name,position,linkvertise_url FROM checkpoints
     WHERE system_id=$1 AND position=$2 AND enabled=TRUE LIMIT 1`,
    [s.system_id, s.current_position]
  );
  if (!cp.rows[0]) return NextResponse.json({ error: "Checkpoint not found." }, { status: 404 });

  const total = await query<{count:string}>(`SELECT count(*)::text count FROM checkpoints WHERE system_id=$1 AND enabled=TRUE`, [s.system_id]);

  const out = {
    id: cp.rows[0].id,
    name: cp.rows[0].name,
    position: cp.rows[0].position,
    total: Number(total.rows[0].count),
    url: (() => {
      const u = new URL(cp.rows[0].linkvertise_url);
      u.searchParams.set("session", s.id);
      u.searchParams.set("checkpoint", cp.rows[0].id);
      return u.toString();
    })()
  };

  return NextResponse.json({ checkpoint: out });
}