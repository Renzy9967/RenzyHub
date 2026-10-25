import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { verifyLinkvertiseHash } from "@/lib/linkvertise";
import { verifyCheckpointSession } from "@/lib/security";
import { redirect } from "next/navigation";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Callback({ searchParams }: Props) {
  const params = await searchParams;
  const hash = typeof params.hash === "string" ? params.hash : "";
  const token = (await cookies()).get("renzyhub_checkpoint")?.value;
  const checkpointSession = token ? await verifyCheckpointSession(token) : null;

  if (!hash || !checkpointSession) {
    return <main className="container"><div className="card" style={{marginTop:80}}><h2>Invalid checkpoint callback</h2><p className="muted">Start a new key session, then complete the Linkvertise checkpoint in the same browser.</p></div></main>;
  }

  const session = await query<{id:string;system_id:string;expires_at:Date;completed_at:Date|null;current_position:number}>(
    `SELECT id,system_id,expires_at,completed_at,current_position FROM checkpoint_sessions WHERE id=$1 LIMIT 1`, [checkpointSession.sessionId]
  );
  const s = session.rows[0];
  if (!s || s.expires_at <= new Date() || s.completed_at) {
    return <main className="container"><div className="card" style={{marginTop:80}}><h2>Session expired</h2><p className="muted">Start a new key session.</p></div></main>;
  }

  const cp = await query<{id:string;system_id:string;position:number;enabled:boolean;provider:string}>(
    `SELECT id,system_id,position,enabled,provider FROM checkpoints WHERE id=$1 AND system_id=$2 LIMIT 1`,
    [checkpointSession.checkpointId, s.system_id]
  );
  if (!cp.rows[0] || !cp.rows[0].enabled || cp.rows[0].position !== s.current_position || cp.rows[0].provider !== "linkvertise") {
    return <main className="container"><div className="card" style={{marginTop:80}}><h2>Invalid checkpoint</h2><p className="muted">The checkpoint is not the active Linkvertise step for this session.</p></div></main>;
  }

  const verification = await verifyLinkvertiseHash(hash);
  if (!verification.ok) {
    return <main className="container"><div className="card" style={{marginTop:80}}><h2>Verification failed</h2><p className="muted">Linkvertise could not confirm this completion. Start a new session and try again.</p></div></main>;
  }

  await query(
    `INSERT INTO checkpoint_completions(session_id,checkpoint_id) VALUES($1,$2)
     ON CONFLICT(session_id,checkpoint_id) DO NOTHING`, [s.id, cp.rows[0].id]
  );

  redirect(`/get-key?session=${encodeURIComponent(s.id)}`);
}
