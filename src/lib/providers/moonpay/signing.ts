import { createHmac, timingSafeEqual } from "crypto";

/**
 * MoonPay widget URL signing: base64 HMAC-SHA256 of the URL's query string
 * (including the leading '?') using the secret key, appended as `signature`.
 */
export function signWidgetUrl(url: string, secretKey: string): string {
  const u = new URL(url);
  const signature = createHmac("sha256", secretKey).update(u.search).digest("base64");
  u.searchParams.set("signature", signature);
  return u.toString();
}

/**
 * Verifies the `Moonpay-Signature-V2` webhook header: `t=<unix>,s=<hex>`, where
 * s = hex HMAC-SHA256(webhookKey, `${t}.${rawBody}`).
 */
export function verifyWebhookSignature(
  rawBody: string,
  header: string | null,
  webhookKey: string,
  opts: { toleranceSeconds?: number; now?: number } = {},
): { valid: boolean; error?: string } {
  if (!header) return { valid: false, error: "missing Moonpay-Signature-V2 header" };
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  const t = parts.t;
  const s = parts.s;
  if (!t || !s) return { valid: false, error: "malformed signature header" };

  const tolerance = opts.toleranceSeconds ?? 300;
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  if (!/^\d+$/.test(t) || Math.abs(now - Number(t)) > tolerance) {
    return { valid: false, error: "signature timestamp outside tolerance" };
  }

  const expected = createHmac("sha256", webhookKey).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(s, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, error: "signature mismatch" };
  }
  return { valid: true };
}
