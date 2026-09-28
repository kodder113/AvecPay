import { describe, expect, it } from "vitest";
import { createHmac } from "crypto";
import { signWidgetUrl, verifyWebhookSignature } from "@/lib/providers/moonpay/signing";

describe("signWidgetUrl", () => {
  it("appends a base64 HMAC-SHA256 of the query string", () => {
    const url = "https://sell-sandbox.moonpay.com?apiKey=pk_test_1&baseCurrencyCode=usdt_trx&baseCurrencyAmount=10";
    const signed = new URL(signWidgetUrl(url, "sk_test_secret"));
    const expected = createHmac("sha256", "sk_test_secret").update(new URL(url).search).digest("base64");
    expect(signed.searchParams.get("signature")).toBe(expected);
    expect(signed.searchParams.get("baseCurrencyAmount")).toBe("10");
  });
});

describe("verifyWebhookSignature", () => {
  const key = "wk_test_key";
  const body = JSON.stringify({ type: "sell_transaction_updated", data: { id: "abc" } });
  const now = 1_800_000_000;
  const sign = (t: number, b = body) => createHmac("sha256", key).update(`${t}.${b}`).digest("hex");

  it("accepts a valid signature", () => {
    expect(verifyWebhookSignature(body, `t=${now},s=${sign(now)}`, key, { now }).valid).toBe(true);
  });
  it("rejects a tampered body", () => {
    expect(verifyWebhookSignature(body + " ", `t=${now},s=${sign(now)}`, key, { now }).valid).toBe(false);
  });
  it("rejects stale timestamps", () => {
    const t = now - 3600;
    expect(verifyWebhookSignature(body, `t=${t},s=${sign(t)}`, key, { now }).error).toMatch(/tolerance/);
  });
  it("rejects missing or malformed headers", () => {
    expect(verifyWebhookSignature(body, null, key).valid).toBe(false);
    expect(verifyWebhookSignature(body, "garbage", key).valid).toBe(false);
  });
});
