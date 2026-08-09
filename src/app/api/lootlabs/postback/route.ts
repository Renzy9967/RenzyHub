import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import crypto from "node:crypto";

function validPuid(sessionId: string, checkpointId: string, puid: string) {
  const expected = crypto.createHmac("sha256", process.env.SESSION_SECRET!)
    .update(`${sessionId}:${checkpointId}`).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(puid));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const clickId = url.searchParams.get("click_id") ?? "";
  const ip = url.searchParams.get("ip") ?? "";
  const uniqueId = url.searchParams.get("unique_id") ?? "";

  if (!clickId || !uniqueId) return NextResponse.json({ ok: false, error: "Missing postback fields." }, { status: 400 });

  const sessions = await query<{id:string;checkpoint_id:string;system_id:string;current_position:number;expires_at:Date;client_ip:string|null}>(
    `SELECT s.id, c.id AS checkpoint_id, s.system_id, s.current_position, s.expires_at, s.client_ip
     FROM checkpoint_sessions s
     JOIN checkpoints c ON c.system_id=s.system_id AND c.position=s.current_position
     WHERE s.expires_at > now()
       AND s.completed_at IS NULL
       AND c.provider='lootlabs'
       AND c.enabled=TRUE
     ORDER BY s.created_at DESC
     LIMIT 100`
  );

  const match = sessions.rows.find(row => {
    try { return validPuid(row.id, row.checkpoint_id, clickId); } catch { return false; }
  });

  if (!match) return NextResponse.json({ ok: false, error: "Unknown click_id." }, { status: 404 });

  if (match.client_ip && ip && match.client_ip !== ip) {
    return NextResponse.json({ ok: false, error: "IP mismatch." }, { status: 403 });
  }

  await query(
    `INSERT INTO lootlabs_postbacks(session_id,checkpoint_id,click_id,unique_id,client_ip)
     VALUES($1,$2,$3,$4,$5)
     ON CONFLICT(unique_id) DO NOTHING`,
    [match.id, match.checkpoint_id, clickId, uniqueId, ip || null]
  );

  await query(
    `INSERT INTO checkpoint_completions(session_id,checkpoint_id)
     VALUES($1,$2)
     ON CONFLICT(session_id,checkpoint_id) DO NOTHING`,
    [match.id, match.checkpoint_id]
  );

  return NextResponse.json({ ok: true });
}
