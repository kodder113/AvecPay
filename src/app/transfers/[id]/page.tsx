import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusTimeline, type TimelineEvent } from "@/components/StatusTimeline";
import { QuoteBreakdown } from "@/components/QuoteBreakdown";
import { CopyButton } from "@/components/CopyButton";
import { AutoRefresh } from "@/components/AutoRefresh";
import { WalletPayCard } from "@/components/wallet";
import { fmtAmount, networkLabel } from "@/lib/format";
import { isTerminal, type TransferStatus } from "@/lib/status";
import { appUrl } from "@/lib/validation";
import { getT } from "@/lib/i18n/server";

export default async function TransferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { t: tr } = await getT();
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
          <h1 className="text-2xl font-bold">{tr({ es: `Para ${recipient?.full_name}`, en: `To ${recipient?.full_name}` })}</h1>
          <p className="text-xs text-slate-500">{tr({ es: `Envío ${t.id}`, en: `Transfer ${t.id}` })}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      {status === "created" && (
        <section className="card space-y-3">
          <h2 className="font-semibold">
            {tr({
              es: `Paso 1 — Envía este enlace a ${recipient?.full_name}`,
              en: `Step 1 — Send this link to ${recipient?.full_name}`,
            })}
          </h2>
          <p className="text-sm text-slate-600">
            {tr({
              es: "Verificará su identidad con MoonPay y agregará una tarjeta de débito Visa elegible. Luego MoonPay crea la dirección de depósito de un solo uso de este envío, que aparecerá aquí.",
              en: "They’ll verify their identity with MoonPay and add an eligible Visa debit card. MoonPay then creates this transfer’s one-time deposit address, which appears here.",
            })}{" "}
            <strong>{tr({ es: "Todavía no envíes USDT.", en: "Do not send USDT yet." })}</strong>
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input readOnly value={claimUrl} className="input font-mono text-xs" />
            <CopyButton value={claimUrl} label={tr({ es: "Copiar enlace", en: "Copy link" })} />
          </div>
          {recipient?.email && (
            <a className="text-sm font-medium text-brand-ink underline" href={`mailto:${recipient.email}?subject=${encodeURIComponent(tr({ es: "Tienes dinero esperándote en Avec Pay", en: "You have money waiting on Avec Pay" }))}&body=${encodeURIComponent(claimUrl)}`}>
              {tr({ es: `Envíalo por correo a ${recipient.email}`, en: `Email it to ${recipient.email}` })}
            </a>
          )}
          {recipient?.phone && (
            <a className="block text-sm font-medium text-brand-ink underline" href={`https://wa.me/${recipient.phone.replace(/\D/g, "")}?text=${encodeURIComponent(claimUrl)}`}>
              {tr({ es: "Enviar por WhatsApp", en: "Send via WhatsApp" })}
            </a>
          )}
        </section>
      )}

      {showDeposit && (
        <section className="card space-y-3 border-amber-300 bg-amber-50">
          <h2 className="font-semibold">
            {t.sender_tx_hash
              ? tr({ es: "Paso 2 — Pago enviado", en: "Step 2 — Payment sent" })
              : tr({
                  es: `Paso 2 — Envía exactamente ${fmtAmount(t.crypto_amount, "USDT", 6)}`,
                  en: `Step 2 — Send exactly ${fmtAmount(t.crypto_amount, "USDT", 6)}`,
                })}
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
            <li>
              {tr({ es: "Red: ", en: "Network: " })}
              <strong>{network || t.crypto_currency_code}</strong>
              {tr({
                es: ". Si envías por cualquier otra red, los fondos se pierden.",
                en: ". Sending on any other network loses the funds.",
              })}
            </li>
            <li>
              {tr({
                es: "MoonPay emitió esta dirección solo para este envío. Nunca la reutilices para otro pago.",
                en: "This address was issued by MoonPay for this transfer only. Never reuse it for another payment.",
              })}
            </li>
            <li>
              {tr({
                es: "Envía desde una billetera que tú controles. Los reembolsos van a tu dirección de reembolso.",
                en: "Send from a wallet you control. Refunds go to your refund address.",
              })}
            </li>
          </ul>
          <div>
            <p className="label">{tr({ es: "Dirección de depósito", en: "Deposit address" })}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input readOnly value={t.deposit_address} className="input font-mono text-xs" />
              <CopyButton value={t.deposit_address} />
            </div>
          </div>
          {t.deposit_address_tag && (
            <div>
              <p className="label">{tr({ es: "Memo / etiqueta (obligatorio)", en: "Memo / tag (required)" })}</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input readOnly value={t.deposit_address_tag} className="input font-mono text-xs" />
                <CopyButton value={t.deposit_address_tag} />
              </div>
            </div>
          )}
          <WalletPayCard
            transferId={t.id}
            network={t.crypto_network}
            contract={t.wallet_pay_contract}
            depositAddress={t.deposit_address}
            depositAddressTag={t.deposit_address_tag}
            amount={String(t.crypto_amount)}
            senderTxHash={t.sender_tx_hash}
          />
        </section>
      )}

      {status === "failed" && (
        <section className="card border-red-200 bg-red-50 text-sm text-red-800">
          <p className="font-semibold">{tr({ es: "Este envío falló.", en: "This transfer failed." })}</p>
          {t.failure_reason && <p className="mt-1">{t.failure_reason}</p>}
          {t.deposit_hash && <p className="mt-1">
              {tr({
                es: `Si se recibieron USDT, MoonPay los reembolsa a ${t.refund_wallet_address}.`,
                en: `If USDT was received, MoonPay refunds it to ${t.refund_wallet_address}.`,
              })}
            </p>}
        </section>
      )}

      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{tr({ es: "Estado", en: "Status" })}</h2>
          <AutoRefresh transferId={t.id} active={!isTerminal(status)} />
        </div>
        <StatusTimeline status={status} events={(events ?? []) as TimelineEvent[]} />
        {t.deposit_hash && (
          <p className="break-all text-xs text-slate-500">
            {tr({ es: `Tx de depósito: ${t.deposit_hash}`, en: `Deposit tx: ${t.deposit_hash}` })}
          </p>
        )}
      </section>

      <section className="card">
        <QuoteBreakdown
          heading={tr({ es: "Estimado al crear", en: "Estimate at creation" })}
          q={{
            cryptoAmount: t.crypto_amount,
            cryptoSymbol: "USDT",
            network,
            fiatCurrency: t.est_fiat_currency,
            exchangeRate: t.est_exchange_rate,
            providerFee: t.est_provider_fee,
            networkFee: t.est_network_fee,
            avecpayFee: t.est_avecpay_fee,
            recipientAmount: t.est_fiat_amount,
            providerName: "MoonPay",
          }}
        />
        {t.final_fiat_amount != null && (
          <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
            {tr({ es: "Monto de la orden de MoonPay: ", en: "MoonPay order amount: " })}
            <strong>{fmtAmount(t.final_fiat_amount, t.final_fiat_currency)}</strong>
          </p>
        )}
      </section>
    </div>
  );
}
