import type { TransferStatus } from "@/lib/status";
import type { AvecPayFeePolicy } from "@/lib/fees";

/**
 * Provider abstraction. Avec Pay talks to off-ramp providers only through this
 * interface so that providers other than MoonPay can be added later.
 *
 * Everything returned here must come from the provider itself. Adapters must
 * not invent capabilities, currencies, limits or fees.
 */

export interface CryptoAsset {
  /** Provider's asset code, e.g. MoonPay 'usdt_trx'. */
  code: string;
  symbol: string; // 'USDT'
  name: string;
  network: string | null; // 'tron', 'ethereum', ...
  /** Token contract the provider reports for this asset, if any. */
  contractAddress: string | null;
  minSellAmount: number | null;
  maxSellAmount: number | null;
}

export interface FiatCurrency {
  code: string; // ISO 4217, lowercased as the provider returns it
  name: string;
  minSellAmount: number | null;
  maxSellAmount: number | null;
}

export interface CorridorCapabilities {
  provider: string;
  country: { code: string; name: string | null; sellAllowed: boolean };
  assets: CryptoAsset[];
  fiatCurrencies: FiatCurrency[];
  payoutMethod: string;
  /** Human-readable reasons the corridor is unavailable, if any. */
  blockers: string[];
  fetchedAt: string;
}

export interface QuoteRequest {
  assetCode: string;
  cryptoAmount: number;
  fiatCurrency: string;
  payoutMethod: string;
  fee: AvecPayFeePolicy;
}

export interface Quote {
  provider: string;
  assetCode: string;
  cryptoAmount: number;
  fiatCurrency: string;
  /** Price of 1 unit of crypto in fiatCurrency, as reported by the provider. */
  exchangeRate: number | null;
  /** Gross fiat value before any fees (cryptoAmount * exchangeRate). */
  grossFiatAmount: number | null;
  providerFee: number | null;
  networkFee: number | null;
  avecpayFee: number | null;
  /** Estimated fiat the recipient receives, as reported by the provider. */
  recipientAmount: number | null;
  payoutMethod: string;
  raw: unknown;
}

export interface RecipientSessionRequest {
  transferId: string;
  assetCode: string;
  cryptoAmount: number;
  fiatCurrency: string | null;
  payoutMethod: string;
  refundWalletAddress: string;
  recipientEmail: string | null;
  redirectUrl: string;
  fee: AvecPayFeePolicy;
}

/** Provider order state normalized into Avec Pay terms. */
export interface ProviderOrder {
  providerTransactionId: string;
  createdAt: string | null;
  /** Avec Pay transfer id echoed back by the provider. */
  externalTransactionId: string | null;
  status: TransferStatus;
  providerStatus: string;
  depositAddress: string | null;
  depositAddressTag: string | null;
  depositHash: string | null;
  assetCode: string | null;
  cryptoAmount: number | null;
  fiatCurrency: string | null;
  fiatAmount: number | null;
  failureReason: string | null;
  raw: unknown;
}

export interface WebhookResult {
  valid: boolean;
  eventType: string | null;
  order: ProviderOrder | null;
  payload: unknown;
  error?: string;
}

export interface PayoutProvider {
  readonly id: string;
  readonly displayName: string;
  /** Countries where the provider reports that selling (off-ramp) is allowed. */
  listPayoutCountries(): Promise<{ code: string; name: string }[]>;
  getCorridor(countryCode: string): Promise<CorridorCapabilities>;
  getQuote(req: QuoteRequest): Promise<Quote>;
  /**
   * Hosted flow where the recipient completes the provider's KYC and payout
   * setup. The provider creates the order and its unique deposit address.
   */
  createRecipientSessionUrl(req: RecipientSessionRequest): string;
  getOrder(providerTransactionId: string): Promise<ProviderOrder>;
  /** All provider orders tagged with this Avec Pay transfer id, oldest first. */
  listOrdersByTransferId(transferId: string): Promise<ProviderOrder[]>;
  handleWebhook(rawBody: string, headers: Headers): Promise<WebhookResult>;
}
