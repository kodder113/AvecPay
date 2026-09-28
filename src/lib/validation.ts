import { z } from "zod";
import type { CorridorCapabilities, CryptoAsset } from "@/lib/providers/types";

export const countryCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}$/, "Use a 2-letter country code")
  .transform((s) => s.toUpperCase());

export const recipientInput = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(200).optional().or(z.literal("").transform(() => undefined)),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]{7,20}$/, "Invalid phone number")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    countryCode,
  })
  .refine((r) => r.email || r.phone, { message: "Recipient email or phone is required", path: ["email"] });

export const quoteInput = z.object({
  countryCode,
  assetCode: z.string().trim().min(2).max(40),
  amount: z.coerce.number().positive().max(1_000_000),
  fiatCurrency: z.string().trim().min(3).max(10).toLowerCase(),
});

export const transferInput = quoteInput.extend({
  recipientId: z.string().uuid().optional(),
  recipient: recipientInput.optional(),
  refundWalletAddress: z.string().trim().min(20).max(120),
});

const EVM_NETWORKS = new Set([
  "ethereum",
  "polygon",
  "binance_smart_chain",
  "bnb_chain",
  "arbitrum",
  "optimism",
  "base",
  "avalanche_c_chain",
]);

/** Basic format check on the sender's refund wallet for the asset's network. */
export function validateRefundAddress(address: string, network: string | null): string | null {
  const n = (network ?? "").toLowerCase();
  if (n === "tron") return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address) ? null : "Not a valid TRON address";
  if (EVM_NETWORKS.has(n)) return /^0x[0-9a-fA-F]{40}$/.test(address) ? null : "Not a valid EVM (0x…) address";
  if (n === "solana") return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address) ? null : "Not a valid Solana address";
  return /^[A-Za-z0-9:_-]{20,120}$/.test(address) ? null : "Not a valid wallet address";
}

/**
 * Checks a requested send against what the provider actually supports.
 * Returns the matched asset, or a list of problems.
 */
export function checkAgainstCorridor(
  corridor: CorridorCapabilities,
  req: { assetCode: string; amount: number; fiatCurrency: string },
): { asset: CryptoAsset | null; problems: string[] } {
  const problems = [...corridor.blockers];
  const asset = corridor.assets.find((a) => a.code === req.assetCode) ?? null;
  if (!asset) problems.push(`${req.assetCode} is not available for ${corridor.country.code} via ${corridor.provider}.`);
  if (asset?.minSellAmount != null && req.amount < asset.minSellAmount) {
    problems.push(`Minimum is ${asset.minSellAmount} ${asset.symbol} (reported by ${corridor.provider}).`);
  }
  if (asset?.maxSellAmount != null && req.amount > asset.maxSellAmount) {
    problems.push(`Maximum is ${asset.maxSellAmount} ${asset.symbol} (reported by ${corridor.provider}).`);
  }
  if (!corridor.fiatCurrencies.some((f) => f.code === req.fiatCurrency)) {
    problems.push(`${req.fiatCurrency.toUpperCase()} is not a payout currency supported by ${corridor.provider}.`);
  }
  return { asset, problems };
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
