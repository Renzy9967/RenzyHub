const ENDPOINT = "https://publisher.linkvertise.com/api/v1/anti_bypassing";

export async function verifyLinkvertiseHash(hash: string) {
  const token = process.env.LINKVERTISE_ANTI_BYPASS_TOKEN;
  if (!token) throw new Error("LINKVERTISE_ANTI_BYPASS_TOKEN is not configured.");

  const url = new URL(ENDPOINT);
  url.searchParams.set("token", token);
  url.searchParams.set("hash", hash);

  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: { accept: "application/json, text/plain, */*" },
  });

  const text = await response.text();

  if (!response.ok) {
    return { ok: false, status: response.status, body: text };
  }

  // Linkvertise may return HTTP 200 with the literal body FALSE when the hash
  // is unknown/expired/already used. Only the documented TRUE response counts.
  const verified = text.trim().toUpperCase() === "TRUE";
  return { ok: verified, status: response.status, body: text };
}