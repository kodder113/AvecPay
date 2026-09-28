import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusTimeline, type TimelineEvent } from "@/components/StatusTimeline";
import { QuoteBreakdown } from "@/components/QuoteBreakdown";
import { CopyButton } from "@/components/CopyButton";
import { AutoRefresh } from "@/components/AutoRefresh";
import { fmtAmount, networkLabel } from "@/lib/format";
import { isTerminal, type TransferStatus } from "@/lib/status";
import { appUrl } from "@/lib/validation";

export default async function TransferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: t } = await supabase
    .from("transfers")
    .select("*, recipients(full_name, email, phone, country_code)")
    .eq("id", id)
    .single();
  if (!t) notFound();
  const { data: events } = await supabase
    .from("transfer_events")
    .select("status, created_at, source")
    .eq("transfer_id", id)
    .order("created_at");

  const status = t.status as TransferStatus;
  const recipient = (Array.isArray(t.recipients) ? t.recipients[0] : t.recipients) as {
    full_name: string;
    email: string | null;
    phone: string | null;
  } | null;
  const claimUrl = `${appUrl()}/r/${t.claim_token}`;
  const network = networkLabel(t.crypto_network);
  const showDeposit = t.deposit_address && status === "awaiting_usdt";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">To {recipient?.full_name}</h1>
          <p className="text-xs text-slate-500">Transfer {t.id}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      {status === "created" && (
        <section className="card space-y-3">
          <h2 className="font-semibold">Step 1 — Send this link to {recipient?.full_name}</h2>
          <p className="text-sm text-slate-600">
            They’ll verify their identity with MoonPay and add an eligible Visa debit card. MoonPay then creates this
            transfer’s one-time deposit address, which appears here. <strong>Do not send USDT yet.</strong>
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input readOnly value={claimUrl} className="input font-mono text-xs" />
            <CopyButton value={claimUrl} label="Copy link" />
          </div>
          {recipient?.email && (
            <a className="text-sm text-brand-700 underline" href={`mailto:${recipient.email}?subject=${encodeURIComponent("You have money waiting on AvicPay")}&body=${encodeURIComponent(claimUrl)}`}>
              Email it to {recipient.email}
            </a>
          )}
          {recipient?.phone && (
            <a className="block text-sm text-brand-700 underline" href={`https://wa.me/${recipient.phone.replace(/\D/g, "")}?text=${encodeURIComponent(claimUrl)}`}>
              Send via WhatsApp
            </a>
          )}
        </section>
      )}

      {showDeposit && (
        <section className="card space-y-3 border-amber-300 bg-amber-50">
          <h2 className="font-semibold">Step 2 — Send exactly {fmtAmount(t.crypto_amount, "USDT", 6)}</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
            <li>
              Network: <strong>{network || t.crypto_currency_code}</strong>. Sending on any other network loses the funds.
            </li>
            <li>This address was issued by MoonPay for this transfer only. Never reuse it for another payment.</li>
            <li>Send from a wallet you control. Refunds go to your refund address.</li>
          </ul>
          <div>
            <p className="label">Deposit address</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input readOnly value={t.deposit_address} className="input font-mono text-xs" />
              <CopyButton value={t.deposit_address} />
            </div>
          </div>
          {t.deposit_address_tag && (
            <div>
              <p className="label">Memo / tag (required)</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input readOnly value={t.deposit_address_tag} className="input font-mono text-xs" />
                <CopyButton value={t.deposit_address_tag} />
              </div>
            </div>
          )}
        </section>
      )}

      {status === "failed" && (
        <section className="card border-red-200 bg-red-50 text-sm text-red-800">
          <p className="font-semibold">This transfer failed.</p>
          {t.failure_reason && <p className="mt-1">{t.failure_reason}</p>}
          {t.deposit_hash && <p className="mt-1">If USDT was received, MoonPay refunds it to {t.refund_wallet_address}.</p>}
        </section>
      )}

      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Status</h2>
          <AutoRefresh transferId={t.id} active={!isTerminal(status)} />
        </div>
        <StatusTimeline status={status} events={(events ?? []) as TimelineEvent[]} />
        {t.deposit_hash && (
          <p className="break-all text-xs text-slate-500">Deposit tx: {t.deposit_hash}</p>
        )}
      </section>

      <section className="card">
        <QuoteBreakdown
          heading="Estimate at creation"
          q={{
            cryptoAmount: t.crypto_amount,
            cryptoSymbol: "USDT",
            network,
            fiatCurrency: t.est_fiat_currency,
            exchangeRate: t.est_exchange_rate,
            providerFee: t.est_provider_fee,
            networkFee: t.est_network_fee,
            avicpayFee: t.est_avicpay_fee,
            recipientAmount: t.est_fiat_amount,
            providerName: "MoonPay",
          }}
        />
        {t.final_fiat_amount != null && (
          <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
            MoonPay order amount: <strong>{fmtAmount(t.final_fiat_amount, t.final_fiat_currency)}</strong>
          </p>
        )}
      </section>
    </div>
  );
}
