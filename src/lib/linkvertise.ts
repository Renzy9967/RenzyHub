
const ENDPOINT = "https://publisher.linkvertise.com/api/v1/anti_bypassing";

export async function verifyLinkvertiseHash(hash: string) {
  const token = process.env.LINKVERTISE_ANTI_BYPASS_TOKEN;

  if (!token) {
    throw new Error("LINKVERTISE_ANTI_BYPASS_TOKEN is not configured.");
  }

  const url = new URL(ENDPOINT);
  url.searchParams.set("token", token);
  url.searchParams.set("hash", hash);

  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: {
      accept: "application/json, text/plain, */*",
    },
  });

  const text = (await response.text()).trim();

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      body: "Linkvertise API request failed.",
    };
  }

  // Format respons berupa teks literal.
  if (text.toUpperCase() === "TRUE") {
    return { ok: true, status: response.status, body: "" };
  }

  // Format respons berupa JSON.
  try {
    const data: unknown = JSON.parse(text);

    if (
      typeof data === "object" &&
      data !== null &&
      "status" in data &&
      data.status === true
    ) {
      return { ok: true, status: response.status, body: "" };
    }
  } catch {
    // Respons bukan JSON yang valid.
  }

  return {
    ok: false,
    status: response.status,
    body: "Linkvertise did not confirm the hash.",
  };
}
