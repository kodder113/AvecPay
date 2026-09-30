import "server-only";
import type { CardStatus } from "@/components/cobros/MerchantSettings";
import { stripeEnabledFor } from "@/lib/stripe";
import type { Db, MerchantRow } from "./context";

/** The owner's sign-in email (for the legacy single-account card mode). */
export async function ownerEmail(db: Db, merchantId: string): Promise<string | null> {
  const { data } = await db.from("merchant_members").select("email").eq("merchant_id", merchantId).eq("role", "owner").maybeSingle();
  return (data?.email as string | undefined) ?? null;
}

/**
 * Card payments: through the merchant's connected Stripe account, or (legacy)
 * through the platform owner's own account for the owner's shop.
 */
export async function cardStatus(db: Db, m: Pick<MerchantRow, "id" | "stripe_account_id" | "stripe_charges_enabled">): Promise<CardStatus> {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) return "unavailable";
  if (m.stripe_account_id) return m.stripe_charges_enabled ? "ready" : "pending";
  if (stripeEnabledFor(await ownerEmail(db, m.id))) return "legacy";
  return "not_connected";
}

export function cardReady(status: CardStatus): boolean {
  return status === "ready" || status === "legacy";
}
