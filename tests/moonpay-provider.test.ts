import { describe, expect, it } from "vitest";
import { MoonPayProvider, moonPayConfigFromEnv } from "@/lib/providers/moonpay/provider";

const cfg = {
  env: "sandbox" as const,
  publishableKey: "pk_test_x",
  secretKey: "sk_test_x",
  webhookKey: "wk_test_x",
  payoutMethod: "credit_debit_card",
};

function fakeFetch(routes: Record<string, unknown>) {
  const calls: string[] = [];
  const f = (async (input: URL | string) => {
    const url = new URL(String(input));
    calls.push(url.toString());
    const body = routes[url.pathname];
    if (body === undefined) return new Response(JSON.stringify({ message: "not found" }), { status: 404 });
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch;
  return { f, calls };
}

const countries = [
  { alpha2: "HN", name: "Honduras", isAllowed: true, isSellAllowed: true },
  { alpha2: "XX", name: "Nowhere", isAllowed: true, isSellAllowed: false },
];
const currencies = [
  { type: "crypto", code: "usdt_trx", name: "Tether (Tron)", isSellSupported: true, minSellAmount: 20, maxSellAmount: 5000, metadata: { networkCode: "tron" } },
  { type: "crypto", code: "usdt", name: "Tether", isSellSupported: true, notAllowedCountries: ["HN"], metadata: { networkCode: "ethereum" } },
  { type: "crypto", code: "usdt_polygon", name: "Tether (Polygon)", isSellSupported: false },
  { type: "crypto", code: "usdt_sol", name: "Tether (Solana)", isSellSupported: true, supportsTestMode: false },
  { type: "crypto", code: "eth", name: "Ether", isSellSupported: true },
  { type: "fiat", code: "usd", name: "US Dollar", isSellSupported: true },
  { type: "fiat", code: "hnl", name: "Lempira", isSellSupported: false },
];

describe("MoonPayProvider.getCorridor", () => {
  it("only offers what MoonPay reports as supported", async () => {
    const { f } = fakeFetch({ "/v3/countries": countries, "/v3/currencies": currencies });
    const c = await new MoonPayProvider(cfg, f).getCorridor("hn");
    expect(c.blockers).toEqual([]);
    expect(c.assets.map((a) => a.code)).toEqual(["usdt_trx"]);
    expect(c.assets[0]).toMatchObject({ network: "tron", minSellAmount: 20, maxSellAmount: 5000 });
    expect(c.fiatCurrencies.map((x) => x.code)).toEqual(["usd"]);
  });

  it("reports a blocker when selling isn't allowed in the country", async () => {
    const { f } = fakeFetch({ "/v3/countries": countries, "/v3/currencies": currencies });
    const c = await new MoonPayProvider(cfg, f).getCorridor("XX");
    expect(c.blockers.join(" ")).toMatch(/not allowed/);
  });
});

describe("MoonPayProvider.getQuote", () => {
  it("passes the AvecPay fee as MoonPay's partner fee and maps the response", async () => {
    const { f, calls } = fakeFetch({
      "/v3/currencies/usdt_trx/sell_quote": {
        baseCurrencyAmount: 10,
        baseCurrencyPrice: 0.999,
        feeAmount: 0.5,
        extraFeeAmount: 0.1,
        quoteCurrencyAmount: 9.38,
        quoteCurrency: { code: "usd" },
      },
    });
    const q = await new MoonPayProvider(cfg, f).getQuote({
      assetCode: "usdt_trx",
      cryptoAmount: 10,
      fiatCurrency: "usd",
      payoutMethod: "credit_debit_card",
      fee: { percent: 1, collection: "moonpay_partner_fee" },
    });
    const url = new URL(calls[0]);
    expect(url.searchParams.get("extraFeePercentage")).toBe("1");
    expect(url.searchParams.get("payoutMethod")).toBe("credit_debit_card");
    expect(q).toMatchObject({ exchangeRate: 0.999, grossFiatAmount: 9.99, providerFee: 0.5, avecpayFee: 0.1, recipientAmount: 9.38, fiatCurrency: "usd" });
  });
});

describe("MoonPayProvider.createRecipientSessionUrl", () => {
  it("builds a signed, amount-locked sell widget URL tied to the transfer", () => {
    const url = new URL(
      new MoonPayProvider(cfg).createRecipientSessionUrl({
        transferId: "t1",
        assetCode: "usdt_trx",
        cryptoAmount: 10,
        fiatCurrency: "usd",
        payoutMethod: "credit_debit_card",
        refundWalletAddress: "TRefund",
        recipientEmail: "c@example.com",
        redirectUrl: "https://app.example/r/tok/return",
        fee: { percent: 0, collection: "moonpay_partner_fee" },
      }),
    );
    expect(url.origin).toBe("https://sell-sandbox.moonpay.com");
    expect(url.searchParams.get("externalTransactionId")).toBe("t1");
    expect(url.searchParams.get("lockAmount")).toBe("true");
    expect(url.searchParams.get("refundWalletAddress")).toBe("TRefund");
    expect(url.searchParams.get("signature")).toBeTruthy();
    expect(url.searchParams.has("extraFeePercentage")).toBe(false);
  });
});

describe("moonPayConfigFromEnv", () => {
  it("refuses live keys in sandbox mode", () => {
    expect(() =>
      moonPayConfigFromEnv({ MOONPAY_ENV: "sandbox", MOONPAY_PUBLISHABLE_KEY: "pk_live_1", MOONPAY_SECRET_KEY: "sk_test_1", MOONPAY_WEBHOOK_KEY: "wk_test_1" } as unknown as NodeJS.ProcessEnv),
    ).toThrow(/test key/);
  });
});
