import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { z } from "zod";

const provider = z.enum(["linkvertise", "lootlabs"]);

const createSchema = z.object({
  systemId: z.string().uuid(),
  name: z.string().min(1).max(100),
  provider,
  url: z.string().url(),
  position: z.number().int().min(1).max(1000).optional(),
  enabled: z.boolean().default(true),
});

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const systems = await query<{id:string;name:string}>(`SELECT id,name FROM key_systems WHERE active=TRUE ORDER BY created_at`);
  const checkpoints = await query(
    `SELECT id,system_id,position,name,provider,COALESCE(url,linkvertise_url) AS url,enabled,created_at
     FROM checkpoints ORDER BY system_id,position`
  );
  return NextResponse.json({ systems: systems.rows, checkpoints: checkpoints.rows });
}

export async function POST(req: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid checkpoint data." }, { status: 400 });

  const system = await query(`SELECT id FROM key_systems WHERE id=$1 AND active=TRUE`, [parsed.data.systemId]);
  if (!system.rows[0]) return NextResponse.json({ error: "System not found." }, { status: 404 });

  const nextPos = await query<{position:number}>(
    `SELECT COALESCE(MAX(position),0)+1 AS position FROM checkpoints WHERE system_id=$1`, [parsed.data.systemId]
  );
  const position = parsed.data.position ?? nextPos.rows[0].position;

  const exists = await query(`SELECT id FROM checkpoints WHERE system_id=$1 AND position=$2`, [parsed.data.systemId, position]);
  if (exists.rows[0]) return NextResponse.json({ error: "That position is already used." }, { status: 409 });

  const row = await query(
    `INSERT INTO checkpoints(system_id,position,name,provider,url,enabled)
     VALUES($1,$2,$3,$4,$5,$6)
     RETURNING id,system_id,position,name,provider,url,enabled,created_at`,
    [parsed.data.systemId, position, parsed.data.name, parsed.data.provider, parsed.data.url, parsed.data.enabled]
  );
  return NextResponse.json({ checkpoint: row.rows[0] }, { status: 201 });
}
