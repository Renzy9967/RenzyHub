import { cookies } from "next/headers";
import { verifyAdminSession } from "./security";

export async function requireAdmin() {
  const token = (await cookies()).get("renzyhub_admin")?.value;
  if (!token) return null;
  return verifyAdminSession(token);
}