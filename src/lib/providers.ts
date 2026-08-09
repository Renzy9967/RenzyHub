import { verifyLinkvertiseHash } from "./linkvertise";

export type CheckpointProvider = "linkvertise" | "lootlabs";

export type ProviderVerification =
  | { ok: true; mode: "redirect"; message?: string }
  | { ok: true; mode: "postback"; message?: string }
  | { ok: false; status?: number; message: string };

export function normalizeProvider(value: string): CheckpointProvider {
  if (value === "lootlabs") return "lootlabs";
  return "linkvertise";
}

export async function verifyCheckpointProvider(
  provider: CheckpointProvider,
  input: { hash?: string }
): Promise<ProviderVerification> {
  if (provider === "linkvertise") {
    if (!input.hash) return { ok: false, status: 400, message: "Missing Linkvertise hash." };
    const result = await verifyLinkvertiseHash(input.hash);
    return result.ok
      ? { ok: true, mode: "redirect" }
      : { ok: false, status: result.status, message: "Linkvertise verification failed." };
  }

  // LootLabs uses a server-to-server postback for completion verification.
  // The browser should not be trusted to declare a LootLabs task complete.
  return { ok: true, mode: "postback" };
}
