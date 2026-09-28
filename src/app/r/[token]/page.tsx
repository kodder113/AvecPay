import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClaimStartButton } from "@/components/ClaimStartButton";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtAmount } from "@/lib/format";
import type { TransferStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

/** Public recipient page, authorized by the unguessable claim token. */
export default async function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = createAdminClient();
  const { data: t } = await db
    .from("transfers")
    .select("status, crypto_amount, est_fiat_amount, est_fiat_currency, final_fiat_amount, final_fiat_currency, recipients(full_name)")
    .eq("claim_token", token)
    .single();
  if (!t) notFound();
  const recipient = (Array.isArray(t.recipients) ? t.recipients[0] : t.recipients) as { full_name: string } | null;
  const status = t.status as TransferStatus;

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <p className="text-sm text-slate-500">Hi {recipient?.full_name},</p>
        <h1 className="text-2xl font-bold">You’ve been sent {fmtAmount(t.crypto_amount, "USDT", 6)}</h1>
        <p className="text-slate-600">
          Estimated payout: <strong>{fmtAmount(t.est_fiat_amount, t.est_fiat_currency)}</strong> (final amount set by MoonPay).
        </p>
        <StatusBadge status={status} />
      </section>

      {status === "created" ? (
        <section className="card space-y-3 text-sm text-slate-600">
          <h2 className="text-base font-semibold text-slate-900">How to receive it</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Continue to MoonPay, our regulated payout partner.</li>
            <li>Verify your identity as MoonPay asks.</li>
            <li>Add an eligible Visa debit card to receive the money (where MoonPay supports card payouts).</li>
            <li>Finish the MoonPay steps. The sender is then asked to send the USDT, and MoonPay pays you.</li>
          </ol>
          <p>
            You do not need to send any crypto yourself. If MoonPay shows you a deposit address, it’s for the sender —
            just complete the flow.
          </p>
          <ClaimStartButton token={token} providerName="MoonPay" />
        </section>
      ) : (
        <p className="card text-sm text-slate-600">
          Your payout is set up with MoonPay. MoonPay emails you about the payout; this page shows the latest status.
        </p>
      )}
    </div>
  );
}
