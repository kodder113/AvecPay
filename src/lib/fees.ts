/**
 * Avec Pay's own fee, kept separate from provider fees so it can be configured
 * (and later priced per corridor) without touching provider code.
 *
 * Avec Pay does not custody funds, so the fee must be collected by the payout
 * provider on Avec Pay's behalf. For MoonPay that is the partner fee
 * (`extraFeePercentage`), which MoonPay deducts and settles to the partner.
 */
export type FeeCollection = "moonpay_partner_fee" | "none";

export interface AvecPayFeePolicy {
  /** Percentage of the sell amount, e.g. 1 = 1%. */
  percent: number;
  collection: FeeCollection;
}

export function getFeePolicy(env: NodeJS.ProcessEnv = process.env): AvecPayFeePolicy {
  const percent = Number(env.AVECPAY_FEE_PERCENT ?? "0");
  if (!Number.isFinite(percent) || percent < 0 || percent > 10) {
    throw new Error("AVECPAY_FEE_PERCENT must be a number between 0 and 10");
  }
  const collection = (env.AVECPAY_FEE_COLLECTION ?? "moonpay_partner_fee") as FeeCollection;
  if (collection !== "moonpay_partner_fee" && collection !== "none") {
    throw new Error("AVECPAY_FEE_COLLECTION must be 'moonpay_partner_fee' or 'none'");
  }
  // A fee that nobody collects must not be shown to users.
  if (collection === "none") return { percent: 0, collection };
  return { percent, collection };
}
