
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { simpleRateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import crypto from "node:crypto";
import {
  signCheckpointSession,
  randomDeviceId,
  hashDeviceId,
  decryptKey,
} from "@/lib/security";

function getIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function buildCheckpointUrl(
  base: string,
  sessionId: string,
  checkpointId: string,
  provider: string
) {
  const url = new URL(base);

  if (provider === "linkvertise") return url.toString();

  url.searchParams.set("session", sessionId);
  url.searchParams.set("checkpoint", checkpointId);

  if (provider === "lootlabs") {
    const secret = process.env.SESSION_SECRET;
    if (!secret) throw new Error("SESSION_SECRET is missing.");

    const puid = crypto
      .createHmac("sha256", secret)
      .update(`${sessionId}:${checkpointId}`)
      .digest("hex");

    url.searchParams.set("puid", puid);
  }

  return url.toString();
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const rl = await simpleRateLimit(`checkpoint-start:${ip}`, 30, 60);

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = z
    .object({ systemId: z.string().uuid().optional() })
    .safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  let deviceId = req.cookies.get("renzyhub_device")?.value;

  if (!deviceId || !/^[A-Za-z0-9_-]{40,60}$/.test(deviceId)) {
    deviceId = randomDeviceId();
  }

  const deviceHash = hashDeviceId(deviceId);

  const system = parsed.data.systemId
    ? await query<{ id: string }>(
        `SELECT id FROM key_systems WHERE id=$1 AND active=TRUE`,
        [parsed.data.systemId]
      )
    : await query<{ id: string }>(
        `SELECT id FROM key_systems
         WHERE name='RenzyHub' AND active=TRUE
         ORDER BY created_at LIMIT 1`
      );

  const systemId = system.rows[0]?.id;

  if (!systemId) {
    return NextResponse.json(
      { error: "No active key system." },
      { status: 404 }
    );
  }

  // Return this browser's existing, unexpired, non-revoked key.
  const existing = await query<{
    encrypted_key: string;
    expires_at: Date;
  }>(
    `SELECT encrypted_key, expires_at
     FROM keys
     WHERE system_id=$1
       AND device_hash=$2
       AND encrypted_key IS NOT NULL
       AND expires_at > now()
       AND revoked_at IS NULL
     ORDER BY expires_at DESC
     LIMIT 1`,
    [systemId, deviceHash]
  );

  if (existing.rows[0]) {
    let key: string;

    try {
      key = decryptKey(existing.rows[0].encrypted_key);
    } catch {
      return NextResponse.json(
        { error: "Could not recover your existing key. Please contact support." },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      key,
      expiresAt: new Date(existing.rows[0].expires_at).toISOString(),
      existing: true,
    });

    setDeviceCookie(response, deviceId);
    return response;
  }

  const cp = await query<{
    id: string;
    name: string;
    position: number;
    provider: string;
    url: string;
  }>(
    `SELECT id, name, position, provider,
            COALESCE(url, linkvertise_url) AS url
     FROM checkpoints
     WHERE system_id=$1 AND enabled=TRUE
     ORDER BY position LIMIT 1`,
    [systemId]
  );

  if (!cp.rows[0]) {
    return NextResponse.json(
      { error: "No checkpoints configured." },
      { status: 500 }
    );
  }

  const session = await query<{ id: string }>(
    `INSERT INTO checkpoint_sessions
       (system_id, current_position, expires_at, client_ip, device_hash)
     VALUES ($1, $2, now() + interval '15 minutes', $3, $4)
     RETURNING id`,
    [systemId, cp.rows[0].position, ip, deviceHash]
  );

  const total = await query<{ count: string }>(
    `SELECT count(*)::text AS count
     FROM checkpoints WHERE system_id=$1 AND enabled=TRUE`,
    [systemId]
  );

  const sessionId = session.rows[0].id;
  const checkpointId = cp.rows[0].id;
  const checkpointToken = await signCheckpointSession(
    sessionId,
    checkpointId
  );

  const response = NextResponse.json({
    sessionId,
    checkpoint: {
      id: checkpointId,
      name: cp.rows[0].name,
      position: cp.rows[0].position,
      total: Number(total.rows[0].count),
      provider: cp.rows[0].provider,
      url: buildCheckpointUrl(
        cp.rows[0].url,
        sessionId,
        checkpointId,
        cp.rows[0].provider
      ),
    },
  });

  response.cookies.set("renzyhub_checkpoint", checkpointToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/checkpoint/callback",
    maxAge: 15 * 60,
  });

  setDeviceCookie(response, deviceId);
  return response;
}

function setDeviceCookie(
  response: NextResponse,
  deviceId: string
) {
  response.cookies.set("renzyhub_device", deviceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
