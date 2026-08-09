import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { signAdminSession, safeEqual } from "@/lib/security";
import { simpleRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const bodySchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await simpleRateLimit(`admin-login:${ip}`, 10, 60);
  if (!rl.allowed) return NextResponse.json({ error: "Too many attempts." }, { status: 429 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  // Primary login source: Vercel environment variables.
  // This makes ADMIN_USERNAME / ADMIN_PASSWORD work without requiring a
  // separate seed step on Vercel. The database admin table remains supported
  // as a fallback for existing installations.
  const envUsername = process.env.ADMIN_USERNAME;
  const envPassword = process.env.ADMIN_PASSWORD;

  let adminId: string | null = null;

  if (
    envUsername &&
    envPassword &&
    safeEqual(parsed.data.username, envUsername) &&
    safeEqual(parsed.data.password, envPassword)
  ) {
    // Stable, non-secret identifier for the env-backed admin session.
    // The session itself is still signed with SESSION_SECRET.
    adminId = "env-admin";
  } else {
    const result = await query<{ id: string; password_hash: string }>(
      `SELECT id, password_hash FROM admins WHERE username = $1 LIMIT 1`,
      [parsed.data.username]
    );
    const admin = result.rows[0];
    if (admin && await bcrypt.compare(parsed.data.password, admin.password_hash)) {
      adminId = admin.id;
    }
  }

  if (!adminId) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const token = await signAdminSession(adminId);
  const response = NextResponse.json({ ok: true });
  response.cookies.set("renzyhub_admin", token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7
  });
  return response;
}