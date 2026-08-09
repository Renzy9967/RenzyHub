import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

const sessionSecret = () => {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
};

export function randomKey() {
  const chunks = Array.from({ length: 3 }, () =>
    crypto.randomBytes(5).toString("hex").toUpperCase()
  );
  return `RENZY-${chunks.join("-")}`;
}

export function hashKey(key: string) {
  return crypto
    .createHmac("sha256", sessionSecret())
    .update(key.trim().toUpperCase())
    .digest("hex");
}

export async function signAdminSession(adminId: string) {
  return new SignJWT({ sub: adminId, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(sessionSecret());
}

export async function verifyAdminSession(token: string) {
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    if (payload.role !== "admin" || typeof payload.sub !== "string") return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}