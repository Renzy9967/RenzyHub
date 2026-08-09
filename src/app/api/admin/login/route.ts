import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { signAdminSession } from "@/lib/security";
import { simpleRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const bodySchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const rl = await simpleRateLimit(`admin-login:${ip}`, 10, 60);

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts." },
      { status: 429 }
    );
  }

  const parsed = bodySchema.safeParse(
    await req.json().catch(() => null)
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input." },
      { status: 400 }
    );
  }

  const { username, password } = parsed.data;

  /*
   * Primary admin authentication.
   *
   * These values come from Vercel Environment Variables:
   *
   * ADMIN_USERNAME
   * ADMIN_PASSWORD
   */
  const envUsername = process.env.ADMIN_USERNAME;
  const envPassword = process.env.ADMIN_PASSWORD;

  if (
    envUsername &&
    envPassword &&
    username === envUsername &&
    password === envPassword
  ) {
    const token = await signAdminSession("env-admin");

    const response = NextResponse.json({ ok: true });

    response.cookies.set("renzyhub_admin", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  }

  /*
   * Database admin fallback.
   */
  const result = await query<{
    id: string;
    password_hash: string;
  }>(
    `SELECT id, password_hash
     FROM admins
     WHERE username = $1
     LIMIT 1`,
    [username]
  );

  const admin = result.rows[0];

  if (
    !admin ||
    !(await bcrypt.compare(password, admin.password_hash))
  ) {
    return NextResponse.json(
      { error: "Invalid credentials." },
      { status: 401 }
    );
  }

  const token = await signAdminSession(admin.id);

  const response = NextResponse.json({ ok: true });

  response.cookies.set("renzyhub_admin", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
```
