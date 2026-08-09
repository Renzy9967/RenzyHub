import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { z } from "zod";
import { hashKey, randomKey } from "@/lib/security";
import crypto from "node:crypto";

function buildCheckpointUrl(base: string, sessionId: string, checkpointId: string, provider: string) {
  const url = new URL(base);
  url.searchParams.set("session", sessionId);
  url.searchParams.set("checkpoint", checkpointId);
  if (provider === "lootlabs") {
    const puid = crypto.createHmac("sha256", process.env.SESSION_SECRET!)
      .update(`${sessionId}:${checkpointId}`)
      .digest("hex");
    url.searchParams.set("puid", puid);
  }
  return url.toString();
}

async function issueKey(systemId: string, sessionId: string) {
  const duration = Number(process.env.DEFAULT_KEY_DURATION ?? 86400);
  const rawKey = randomKey();
  const keyHash = hashKey(rawKey);
  const expires = new Date(Date.now() + duration * 1000);
  await query(
    `INSERT INTO keys(system_id, key_hash, key_prefix, activated_at, expires_at)
     VALUES ($1, $2, $3, now(), $4)`,
    [systemId, keyHash, rawKey.slice(0, 11), expires]
  );
  await query(`UPDATE checkpoint_sessions SET completed_at = now() WHERE id = $1`, [sessionId]);
  return { key: rawKey, expiresAt: expires.toISOString() };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = z.string().uuid().safeParse(url.searchParams.get("session"));
  if (!parsed.success) return NextResponse.json({ error: "Invalid session." }, { status: 400 });

  const session = await query<{
    id:string; system_id:string; current_position:number; expires_at:Date; completed_at:Date|null; client_ip:string|null
  }>(
    `SELECT id, system_id, current_position, expires_at, completed_at, client_ip
     FROM checkpoint_sessions WHERE id=$1 LIMIT 1`, [parsed.data]
  );
  const s = session.rows[0];
  if (!s || s.expires_at <= new Date()) return NextResponse.json({ error: "Session expired." }, { status: 410 });

  if (s.completed_at) return NextResponse.json({ error: "Session already completed." }, { status: 409 });

  const cp = await query<{id:string;name:string;position:number;provider:string;url:string}>(
    `SELECT id,name,position,provider,COALESCE(url,linkvertise_url) AS url
     FROM checkpoints
     WHERE system_id=$1 AND position=$2 AND enabled=TRUE LIMIT 1`,
    [s.system_id, s.current_position]
  );
  if (!cp.rows[0]) return NextResponse.json({ error: "Checkpoint not found." }, { status: 404 });

  if (cp.rows[0].provider === "lootlabs") {
    const completion = await query<{id:string}>(
      `SELECT id FROM checkpoint_completions
       WHERE session_id=$1 AND checkpoint_id=$2 LIMIT 1`,
      [s.id, cp.rows[0].id]
    );
    if (!completion.rows[0]) {
      return NextResponse.json({
        completed: false,
        checkpoint: {
          id: cp.rows[0].id,
          name: cp.rows[0].name,
          position: cp.rows[0].position,
          total: Number((await query<{count:string}>(
            `SELECT count(*)::text count FROM checkpoints WHERE system_id=$1 AND enabled=TRUE`, [s.system_id]
          )).rows[0].count),
          provider: cp.rows[0].provider,
          url: buildCheckpointUrl(cp.rows[0].url, s.id, cp.rows[0].id, cp.rows[0].provider),
        }
      });
    }
  }

  const next = await query<{id:string;name:string;position:number;provider:string;url:string}>(
    `SELECT id,name,position,provider,COALESCE(url,linkvertise_url) AS url
     FROM checkpoints
     WHERE system_id=$1 AND enabled=TRUE AND position>$2
     ORDER BY position ASC LIMIT 1`,
    [s.system_id, s.current_position]
  );

  if (next.rows[0]) {
    await query(`UPDATE checkpoint_sessions SET current_position=$2 WHERE id=$1`, [s.id, next.rows[0].position]);
    const total = await query<{count:string}>(`SELECT count(*)::text count FROM checkpoints WHERE system_id=$1 AND enabled=TRUE`, [s.system_id]);
    return NextResponse.json({
      checkpoint: {
        id: next.rows[0].id, name: next.rows[0].name, position: next.rows[0].position,
        total: Number(total.rows[0].count), provider: next.rows[0].provider,
        url: buildCheckpointUrl(next.rows[0].url, s.id, next.rows[0].id, next.rows[0].provider)
      }
    });
  }

  return NextResponse.json(await issueKey(s.system_id, s.id));
}
