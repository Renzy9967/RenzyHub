import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).max(100).optional(),
  provider: z.enum(["linkvertise","lootlabs"]).optional(),
  url: z.string().url().optional(),
  position: z.number().int().min(1).max(1000).optional(),
  enabled: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{id:string}> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data).length === 0) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  const current = await query<{system_id:string;position:number;name:string;provider:string;url:string;enabled:boolean}>(
    `SELECT system_id,position,name,provider,COALESCE(url,linkvertise_url) AS url,enabled FROM checkpoints WHERE id=$1`, [id]
  );
  if (!current.rows[0]) return NextResponse.json({ error: "Checkpoint not found." }, { status: 404 });
  const c = current.rows[0];
  const next = {...c, ...parsed.data};

  if (next.position !== c.position) {
    const conflict = await query(`SELECT id FROM checkpoints WHERE system_id=$1 AND position=$2 AND id<>$3`, [c.system_id,next.position,id]);
    if (conflict.rows[0]) return NextResponse.json({ error: "That position is already used." }, { status: 409 });
  }

  const row = await query(
    `UPDATE checkpoints
     SET name=$2,provider=$3,url=$4,position=$5,enabled=$6
     WHERE id=$1
     RETURNING id,system_id,position,name,provider,url,enabled,created_at`,
    [id,next.name,next.provider,next.url,next.position,next.enabled]
  );
  return NextResponse.json({ checkpoint: row.rows[0] });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{id:string}> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const row = await query(`DELETE FROM checkpoints WHERE id=$1 RETURNING id`, [id]);
  if (!row.rows[0]) return NextResponse.json({ error: "Checkpoint not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
