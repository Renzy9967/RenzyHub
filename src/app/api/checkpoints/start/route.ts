import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { simpleRateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import crypto from "node:crypto";

function getIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function buildCheckpointUrl(base: string, sessionId: string, checkpointId: string, provider: string) {
  const url = new URL(base);
  url.searchParams.set("session", sessionId);
  url.searchParams.set("checkpoint", checkpointId);
  if (provider === "lootlabs") {
    // LootLabs postback returns this value as click_id.
    const puid = crypto.createHmac("sha256", process.env.SESSION_SECRET!)
      .update(`${sessionId}:${checkpointId}`)
      .digest("hex");
    url.searchParams.set("puid", puid);
  }
  return url.toString();
}

export async function POST(req: Request) {
  const ip = getIp(req);
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

  const cp = await query<{id:string;name:string;position:number;provider:string;url:string}>(
    `SELECT id, name, position, provider, COALESCE(url, linkvertise_url) AS url
     FROM checkpoints
     WHERE system_id=$1 AND enabled=TRUE
     ORDER BY position LIMIT 1`,
    [systemId]
  );
  if (!cp.rows[0]) return NextResponse.json({ error: "No checkpoints configured." }, { status: 500 });

  const session = await query<{id:string}>(
    `INSERT INTO checkpoint_sessions(system_id,current_position,expires_at,client_ip)
     VALUES ($1,1,now() + interval '15 minutes',$2)
     RETURNING id`,
    [systemId, ip]
  );

  const total = await query<{count:string}>(
    `SELECT count(*)::text AS count FROM checkpoints WHERE system_id=$1 AND enabled=TRUE`,
    [systemId]
  );

  return NextResponse.json({
    sessionId: session.rows[0].id,
    checkpoint: {
      id: cp.rows[0].id,
      name: cp.rows[0].name,
      position: cp.rows[0].position,
      total: Number(total.rows[0].count),
      provider: cp.rows[0].provider,
      url: buildCheckpointUrl(cp.rows[0].url, session.rows[0].id, cp.rows[0].id, cp.rows[0].provider),
    }
  });
}
