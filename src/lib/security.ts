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


/**
 * Browser identity
 * Simpan hanya hash device ID di database.
 */
export function randomDeviceId() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashDeviceId(deviceId: string) {
  return crypto
    .createHmac("sha256", sessionSecret())
    .update(deviceId)
    .digest("hex");
}

/**
 * Encrypt/decrypt keys with AES-256-GCM.
 * Kunci enkripsi diturunkan dari SESSION_SECRET.
 */
function getEncryptionKey() {
  return crypto
    .createHash("sha256")
    .update(sessionSecret())
    .update("renzyhub-key-encryption-v1")
    .digest();
}

export function encryptKey(key: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    iv
  );

  const ciphertext = Buffer.concat([
    cipher.update(key, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptKey(encrypted: string) {
  const parts = encrypted.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted key format.");
  }

  const [ivPart, tagPart, ciphertextPart] = parts;
  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  const ciphertext = Buffer.from(ciphertextPart, "base64url");

  if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
    throw new Error("Invalid encrypted key data.");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    iv
  );

  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
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

export async function signCheckpointSession(sessionId: string, checkpointId: string) {
  return new SignJWT({ purpose: "checkpoint", checkpointId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sessionId)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(sessionSecret());
}

export async function verifyCheckpointSession(token: string) {
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    if (payload.purpose !== "checkpoint" || typeof payload.sub !== "string" || typeof payload.checkpointId !== "string") return null;
    return { sessionId: payload.sub, checkpointId: payload.checkpointId };
  } catch {
    return null;
  }
}
