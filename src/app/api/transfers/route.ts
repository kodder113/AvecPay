import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { providerForCorridor } from "@/lib/providers/registry";
import { appUrl, checkAgainstCorridor, transferInput, validateRefundAddress } from "@/lib/validation";
import { getFeePolicy } from "@/lib/fees";
import { handleRouteError, jsonError } from "@/lib/http";

/**
 * Creates an AvecPay transfer. The quote is re-fetched server-side; the
 * client's numbers are never trusted. The provider order (and its deposit
 * address) is created later, when the recipient completes the provider flow.
 */
export async function POST(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return jsonError(401, "Sign in required");
  try {
    const input = transferInput.parse(await req.json());
    if (!input.recipientId && !input.recipient) return jsonError(400, "Recipient is required");

    const provider = providerForCorridor(input.countryCode);
    const corridor = await provider.getCorridor(input.countryCode);
    const { asset, problems } = checkAgainstCorridor(corridor, input);
    if (problems.length || !asset) return jsonError(422, "Not supported", problems);

    const addrProblem = validateRefundAddress(input.refundWalletAddress, asset.network);
    if (addrProblem) return jsonError(400, addrProblem);

    const fee = getFeePolicy();
    const quote = await provider.getQuote({
      assetCode: asset.code,
      cryptoAmount: input.amount,
      fiatCurrency: input.fiatCurrency,
      payoutMethod: corridor.payoutMethod,
      fee,
    });

    // Recipient: existing (RLS enforces ownership) or new.
    let recipientId = input.recipientId;
    if (recipientId) {
      const { data, error } = await supabase.from("recipients").select("id, country_code").eq("id", recipientId).single();
      if (error || !data) return jsonError(404, "Recipient not found");
      if (data.country_code !== input.countryCode) return jsonError(400, "Recipient country does not match");
    } else {
      const r = input.recipient!;
      const { data, error } = await supabase
        .from("recipients")
        .insert({
          user_id: user.id,
          full_name: r.fullName,
          email: r.email ?? null,
          phone: r.phone ?? null,
          country_code: input.countryCode,
        })
        .select("id")
        .single();
      if (error || !data) throw error ?? new Error("Could not save recipient");
      recipientId = data.id;
    }

    const claimToken = randomBytes(24).toString("base64url");
    const db = createAdminClient();
    const { data: transfer, error } = await db
      .from("transfers")
      .insert({
        user_id: user.id,
        recipient_id: recipientId,
        provider: provider.id,
        status: "created",
        crypto_currency_code: asset.code,
        crypto_network: asset.network,
        crypto_amount: input.amount,
        recipient_country: input.countryCode,
        payout_method: corridor.payoutMethod,
        refund_wallet_address: input.refundWalletAddress,
        est_fiat_currency: quote.fiatCurrency,
        est_fiat_amount: quote.recipientAmount,
        est_exchange_rate: quote.exchangeRate,
        est_provider_fee: quote.providerFee,
        est_network_fee: quote.networkFee,
        est_avecpay_fee: quote.avecpayFee,
        quote_raw: quote.raw,
        claim_token: claimToken,
      })
      .select("id")
      .single();
    if (error || !transfer) throw error ?? new Error("Could not create transfer");

    await db.from("transfer_events").insert({ transfer_id: transfer.id, status: "created", source: "system" });

    return NextResponse.json({ id: transfer.id, claimUrl: `${appUrl()}/r/${claimToken}` }, { status: 201 });
  } catch (e) {
    return handleRouteError(e);
  }
}
