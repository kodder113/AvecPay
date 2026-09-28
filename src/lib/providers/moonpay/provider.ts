import type {
  CorridorCapabilities,
  CryptoAsset,
  FiatCurrency,
  PayoutProvider,
  ProviderOrder,
  Quote,
  QuoteRequest,
  RecipientSessionRequest,
  WebhookResult,
} from "@/lib/providers/types";
import { signWidgetUrl, verifyWebhookSignature } from "./signing";
import { mapMoonPaySellStatus } from "./status";

export interface MoonPayConfig {
  env: "sandbox" | "production";
  publishableKey: string;
  secretKey: string;
  webhookKey: string;
  payoutMethod: string;
  apiBase?: string;
}

const SELL_WIDGET_BASE = {
  sandbox: "https://sell-sandbox.moonpay.com",
  production: "https://sell.moonpay.com",
} as const;

export function moonPayConfigFromEnv(env: NodeJS.ProcessEnv = process.env): MoonPayConfig {
  const mode = env.MOONPAY_ENV === "production" ? "production" : "sandbox";
  const cfg: MoonPayConfig = {
    env: mode,
    publishableKey: env.MOONPAY_PUBLISHABLE_KEY ?? "",
    secretKey: env.MOONPAY_SECRET_KEY ?? "",
    webhookKey: env.MOONPAY_WEBHOOK_KEY ?? "",
    payoutMethod: env.MOONPAY_PAYOUT_METHOD || "credit_debit_card",
  };
  const missing = (["publishableKey", "secretKey", "webhookKey"] as const).filter((k) => !cfg[k]);
  if (missing.length) throw new Error(`MoonPay is not configured: missing ${missing.join(", ")}`);

  // Guard against mixing live keys into sandbox (or the reverse).
  const expectedPrefix = mode === "production" ? "_live_" : "_test_";
  for (const k of ["publishableKey", "secretKey", "webhookKey"] as const) {
    if (!cfg[k].includes(expectedPrefix)) {
      throw new Error(`MOONPAY_ENV=${mode} but ${k} does not look like a ${expectedPrefix.slice(1, -1)} key`);
    }
  }
  return cfg;
}

// --- Raw MoonPay shapes (only the fields we read; everything else stays in `raw`) ---

interface MpCurrency {
  type: "crypto" | "fiat";
  code: string;
  name: string;
  isSellSupported?: boolean;
  isSuspended?: boolean;
  supportsTestMode?: boolean;
  minSellAmount?: number | null;
  maxSellAmount?: number | null;
  notAllowedCountries?: string[];
  metadata?: { networkCode?: string | null; contractAddress?: string | null } | null;
}

interface MpCountry {
  alpha2: string;
  name: string;
  isAllowed?: boolean;
  isSellAllowed?: boolean;
}

interface MpSellTransaction {
  id: string;
  createdAt?: string | null;
  status: string;
  externalTransactionId?: string | null;
  depositHash?: string | null;
  depositWallet?: { walletAddress?: string | null; walletAddressTag?: string | null } | null;
  depositWalletAddress?: string | null;
  depositWalletAddressTag?: string | null;
  baseCurrencyAmount?: number | null;
  baseCurrency?: { code?: string } | null;
  baseCurrencyCode?: string | null;
  quoteCurrencyAmount?: number | null;
  quoteCurrency?: { code?: string } | null;
  quoteCurrencyCode?: string | null;
  failureReason?: string | null;
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

export function isUsdtCode(code: string): boolean {
  return code === "usdt" || code.startsWith("usdt_");
}

export function normalizeSellTransaction(tx: MpSellTransaction): ProviderOrder {
  return {
    providerTransactionId: tx.id,
    createdAt: tx.createdAt ?? null,
    externalTransactionId: tx.externalTransactionId ?? null,
    status: mapMoonPaySellStatus(tx),
    providerStatus: tx.status,
    depositAddress: tx.depositWallet?.walletAddress ?? tx.depositWalletAddress ?? null,
    depositAddressTag: tx.depositWallet?.walletAddressTag ?? tx.depositWalletAddressTag ?? null,
    depositHash: tx.depositHash ?? null,
    assetCode: tx.baseCurrency?.code ?? tx.baseCurrencyCode ?? null,
    cryptoAmount: num(tx.baseCurrencyAmount),
    fiatCurrency: tx.quoteCurrency?.code ?? tx.quoteCurrencyCode ?? null,
    fiatAmount: num(tx.quoteCurrencyAmount),
    failureReason: tx.failureReason ?? null,
    raw: tx,
  };
}

export class MoonPayProvider implements PayoutProvider {
  readonly id = "moonpay";
  readonly displayName = "MoonPay";
  private readonly apiBase: string;

  constructor(
    private readonly cfg: MoonPayConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.apiBase = cfg.apiBase ?? "https://api.moonpay.com";
  }

  private async get<T>(path: string, params: Record<string, string> = {}, auth: "public" | "secret" = "public"): Promise<T> {
    const url = new URL(path, this.apiBase);
    if (auth === "public") url.searchParams.set("apiKey", this.cfg.publishableKey);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await this.fetchImpl(url, {
      headers: {
        Accept: "application/json",
        ...(auth === "secret" ? { Authorization: `Api-Key ${this.cfg.secretKey}` } : {}),
      },
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      let message = text;
      try {
        message = (JSON.parse(text) as { message?: string }).message ?? text;
      } catch {}
      throw new MoonPayError(res.status, `MoonPay ${path} failed (${res.status}): ${message}`);
    }
    return JSON.parse(text) as T;
  }

  async listPayoutCountries(): Promise<{ code: string; name: string }[]> {
    const countries = await this.get<MpCountry[]>("/v3/countries");
    return countries
      .filter((c) => c.isAllowed !== false && c.isSellAllowed)
      .map((c) => ({ code: c.alpha2.toUpperCase(), name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getCorridor(countryCode: string): Promise<CorridorCapabilities> {
    const cc = countryCode.toUpperCase();
    const [countries, currencies] = await Promise.all([
      this.get<MpCountry[]>("/v3/countries"),
      this.get<MpCurrency[]>("/v3/currencies"),
    ]);

    const blockers: string[] = [];
    const country = countries.find((c) => c.alpha2?.toUpperCase() === cc);
    const sellAllowed = Boolean(country?.isAllowed !== false && country?.isSellAllowed);
    if (!country) blockers.push(`MoonPay does not list country ${cc}.`);
    else if (!sellAllowed) blockers.push(`MoonPay reports that selling (off-ramp) is not allowed in ${country.name}.`);

    const assets: CryptoAsset[] = currencies
      .filter((c) => c.type === "crypto" && isUsdtCode(c.code))
      .filter((c) => c.isSellSupported && !c.isSuspended)
      .filter((c) => !(c.notAllowedCountries ?? []).map((x) => x.toUpperCase()).includes(cc))
      .filter((c) => this.cfg.env === "production" || c.supportsTestMode !== false)
      .map((c) => ({
        code: c.code,
        symbol: "USDT",
        name: c.name,
        network: c.metadata?.networkCode ?? null,
        contractAddress: c.metadata?.contractAddress ?? null,
        minSellAmount: num(c.minSellAmount),
        maxSellAmount: num(c.maxSellAmount),
      }));
    if (!assets.length) {
      blockers.push(
        this.cfg.env === "sandbox"
          ? "MoonPay sandbox reports no sell-enabled USDT asset that supports test mode for this country."
          : "MoonPay reports no sell-enabled USDT asset for this country.",
      );
    }

    const fiatCurrencies: FiatCurrency[] = currencies
      .filter((c) => c.type === "fiat" && c.isSellSupported && !c.isSuspended)
      .map((c) => ({
        code: c.code,
        name: c.name,
        minSellAmount: num(c.minSellAmount),
        maxSellAmount: num(c.maxSellAmount),
      }));
    if (!fiatCurrencies.length) blockers.push("MoonPay reports no sell-enabled fiat currencies.");

    return {
      provider: this.id,
      country: { code: cc, name: country?.name ?? null, sellAllowed },
      assets,
      fiatCurrencies,
      payoutMethod: this.cfg.payoutMethod,
      blockers,
      fetchedAt: new Date().toISOString(),
    };
  }

  async getQuote(req: QuoteRequest): Promise<Quote> {
    const params: Record<string, string> = {
      baseCurrencyAmount: String(req.cryptoAmount),
      quoteCurrencyCode: req.fiatCurrency,
      payoutMethod: req.payoutMethod,
    };
    if (req.fee.collection === "moonpay_partner_fee" && req.fee.percent > 0) {
      params.extraFeePercentage = String(req.fee.percent);
    }
    const q = await this.get<Record<string, unknown>>(
      `/v3/currencies/${encodeURIComponent(req.assetCode)}/sell_quote`,
      params,
    );

    const cryptoAmount = num(q.baseCurrencyAmount) ?? req.cryptoAmount;
    const exchangeRate = num(q.baseCurrencyPrice);
    const quoteCurrency = (q.quoteCurrency as { code?: string } | undefined)?.code ?? req.fiatCurrency;
    return {
      provider: this.id,
      assetCode: req.assetCode,
      cryptoAmount,
      fiatCurrency: quoteCurrency,
      exchangeRate,
      grossFiatAmount: exchangeRate != null ? round(cryptoAmount * exchangeRate, 2) : null,
      providerFee: num(q.feeAmount),
      networkFee: num(q.networkFeeAmount),
      avecpayFee: req.fee.percent > 0 ? num(q.extraFeeAmount) : 0,
      recipientAmount: num(q.quoteCurrencyAmount),
      payoutMethod: (q.payoutMethod as string | undefined) ?? req.payoutMethod,
      raw: q,
    };
  }

  createRecipientSessionUrl(req: RecipientSessionRequest): string {
    const url = new URL(SELL_WIDGET_BASE[this.cfg.env]);
    const p = url.searchParams;
    p.set("apiKey", this.cfg.publishableKey);
    p.set("baseCurrencyCode", req.assetCode);
    p.set("baseCurrencyAmount", String(req.cryptoAmount));
    // The sender funds a fixed amount, so the recipient must not change it.
    p.set("lockAmount", "true");
    if (req.fiatCurrency) p.set("quoteCurrencyCode", req.fiatCurrency);
    p.set("paymentMethod", req.payoutMethod);
    p.set("refundWalletAddress", req.refundWalletAddress);
    p.set("externalTransactionId", req.transferId);
    p.set("redirectURL", req.redirectUrl);
    if (req.recipientEmail) p.set("email", req.recipientEmail);
    if (req.fee.collection === "moonpay_partner_fee" && req.fee.percent > 0) {
      p.set("extraFeePercentage", String(req.fee.percent));
    }
    return signWidgetUrl(url.toString(), this.cfg.secretKey);
  }

  async getOrder(providerTransactionId: string): Promise<ProviderOrder> {
    const tx = await this.get<MpSellTransaction>(
      `/v3/sell_transactions/${encodeURIComponent(providerTransactionId)}`,
      {},
      "secret",
    );
    return normalizeSellTransaction(tx);
  }

  async listOrdersByTransferId(transferId: string): Promise<ProviderOrder[]> {
    try {
      const res = await this.get<MpSellTransaction | MpSellTransaction[]>(
        `/v3/sell_transactions/ext/${encodeURIComponent(transferId)}`,
        {},
        "secret",
      );
      return (Array.isArray(res) ? res : [res])
        .map(normalizeSellTransaction)
        .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
    } catch (e) {
      if (e instanceof MoonPayError && e.status === 404) return [];
      throw e;
    }
  }

  async handleWebhook(rawBody: string, headers: Headers): Promise<WebhookResult> {
    const sig = verifyWebhookSignature(rawBody, headers.get("moonpay-signature-v2"), this.cfg.webhookKey);
    let payload: { type?: string; data?: { id?: string } } | null = null;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return { valid: false, eventType: null, order: null, payload: rawBody, error: "invalid JSON" };
    }
    const eventType = payload?.type ?? null;
    if (!sig.valid) return { valid: false, eventType, order: null, payload, error: sig.error };
    if (!eventType?.startsWith("sell_transaction") || !payload?.data?.id) {
      return { valid: true, eventType, order: null, payload };
    }
    // Don't trust the webhook body for state: re-read the order from the API.
    const order = await this.getOrder(payload.data.id);
    return { valid: true, eventType, order, payload };
  }
}

export class MoonPayError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
