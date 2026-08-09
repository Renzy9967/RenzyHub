import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { verifyLinkvertiseHash } from "@/lib/linkvertise";
import { hashKey } from "@/lib/security";
import crypto from "node:crypto";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Callback({ searchParams }: Props) {
  const params = await searchParams;
  const sessionId = typeof params.session === "string" ? params.session : "";
  const checkpointId = typeof params.checkpoint === "string" ? params.checkpoint : "";
  const hash = typeof params.hash === "string" ? params.hash : "";

  if (!sessionId || !checkpointId || !hash) {
    return <main className="container"><div className="card" style={{ marginTop: 80 }}><h2>Invalid checkpoint callback</h2><p className="muted">Missing verification parameters.</p></div></main>;
  }

  const session = await query<{ id: string; system_id: string; expires_at: Date; completed_at: Date | null; current_position: number }>(
    `SELECT id, system_id, expires_at, completed_at, current_position
     FROM checkpoint_sessions WHERE id = $1 LIMIT 1`, [sessionId]
  );

  if (!session.rows[0] || session.rows[0].expires_at <= new Date() || session.rows[0].completed_at) {
    return <main className="container"><div className="card" style={{ marginTop: 80 }}><h2>Session expired</h2><p className="muted">Start a new key session.</p></div></main>;
  }

  const cp = await query<{ id: string; system_id: string; position: number; enabled: boolean }>(
    `SELECT id, system_id, position, enabled FROM checkpoints WHERE id = $1 AND system_id = $2 LIMIT 1`,
    [checkpointId, session.rows[0].system_id]
  );

  if (!cp.rows[0] || !cp.rows[0].enabled || cp.rows[0].position !== session.rows[0].current_position) {
    return <main className="container"><div className="card" style={{ marginTop: 80 }}><h2>Invalid checkpoint</h2></div></main>;
  }

  const verification = await verifyLinkvertiseHash(hash);
  if (!verification.ok) {
    return <main className="container"><div className="card" style={{ marginTop: 80 }}><h2>Verification failed</h2><p className="muted">The Linkvertise verification could not be confirmed. Please restart the checkpoint.</p></div></main>;
  }

  await query(
    `INSERT INTO checkpoint_completions(session_id, checkpoint_id)
     VALUES ($1, $2)
     ON CONFLICT(session_id, checkpoint_id) DO NOTHING`,
    [sessionId, checkpointId]
  );

  const next = await query<{ id: string; name: string; position: number; linkvertise_url: string }>(
    `SELECT id, name, position, linkvertise_url
     FROM checkpoints
     WHERE system_id = $1 AND enabled = TRUE AND position > $2
     ORDER BY position ASC LIMIT 1`,
    [session.rows[0].system_id, cp.rows[0].position]
  );

  if (next.rows[0]) {
    await query(
      `UPDATE checkpoint_sessions SET current_position = $2 WHERE id = $1`,
      [sessionId, next.rows[0].position]
    );
  } else {
    const duration = Number(process.env.DEFAULT_KEY_DURATION ?? 86400);
    const rawKey = `RENZY-${crypto.randomBytes(5).toString("hex").toUpperCase()}-${crypto.randomBytes(5).toString("hex").toUpperCase()}-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
    const keyHash = hashKey(rawKey);
    const expires = new Date(Date.now() + duration * 1000);

    await query(
      `INSERT INTO keys(system_id, key_hash, key_prefix, activated_at, expires_at)
       VALUES ($1, $2, $3, now(), $4)`,
      [session.rows[0].system_id, keyHash, rawKey.slice(0, 11), expires]
    );

    await query(
      `UPDATE checkpoint_sessions SET completed_at = now() WHERE id = $1`,
      [sessionId]
    );

    const encoded = encodeURIComponent(rawKey);
    redirect(`/checkpoint/success?key=${encoded}`);
  }

  redirect(`/get-key?session=${encodeURIComponent(sessionId)}`);
}