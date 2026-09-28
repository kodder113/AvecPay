import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProvider } from "@/lib/providers/registry";
import { getFeePolicy } from "@/lib/fees";
import { appUrl } from "@/lib/validation";
import { handleRouteError, jsonError } from "@/lib/http";

/**
 * Recipient (unauthenticated, holds the claim token) starts the provider's
 * hosted KYC + payout-method flow. The provider creates the sell order and its
 * unique deposit address at the end of that flow.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = createAdminClient();
  const { data: t } = await db
    .from("transfers")
    .select(
      "id, status, provider, crypto_currency_code, crypto_amount, est_fiat_currency, payout_method, refund_wallet_address, provider_transaction_id, recipients(email)",
    )
    .eq("claim_token", token)
    .single();
  if (!t) return jsonError(404, "Link not found");
  if (t.status !== "created" || t.provider_transaction_id) {
    return jsonError(409, "This transfer has already been set up with the payout provider.");
  }

  try {
    const provider = getProvider(t.provider);
    // If an order already exists (e.g. the redirect was lost), never open a second one.
    const existing = await provider.listOrdersByTransferId(t.id);
    if (existing.length) return jsonError(409, "This transfer has already been set up with the payout provider.");

    const recipient = Array.isArray(t.recipients) ? t.recipients[0] : t.recipients;
    const url = provider.createRecipientSessionUrl({
      transferId: t.id,
      assetCode: t.crypto_currency_code,
      cryptoAmount: Number(t.crypto_amount),
      fiatCurrency: t.est_fiat_currency,
      payoutMethod: t.payout_method,
      refundWalletAddress: t.refund_wallet_address,
      recipientEmail: (recipient as { email: string | null } | null)?.email ?? null,
      redirectUrl: `${appUrl()}/r/${token}/return`,
      fee: getFeePolicy(),
    });
    return NextResponse.json({ url });
  } catch (e) {
    return handleRouteError(e);
  }
}
