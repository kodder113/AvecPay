"use client";
import { fmtAmount } from "@/lib/format";
import { useT } from "@/components/i18n/LangProvider";

export interface QuoteView {
  cryptoAmount: number | string | null;
  cryptoSymbol: string;
  network?: string | null;
  fiatCurrency: string | null;
  exchangeRate: number | string | null;
  grossFiatAmount?: number | string | null;
  providerFee: number | string | null;
  networkFee: number | string | null;
  avecpayFee: number | string | null;
  recipientAmount: number | string | null;
  providerName: string;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className={`text-right text-sm ${strong ? "text-base font-bold" : "font-medium"}`}>{value}</dd>
    </div>
  );
}

export function QuoteBreakdown({ q, heading }: { q: QuoteView; heading?: string }) {
  const t = useT();
  const fiat = q.fiatCurrency;
  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">{heading ?? t({ es: "Estimado", en: "Estimate" })}</h3>
      <dl className="divide-y divide-slate-100">
        <Row label={t({ es: "Tú envías", en: "You send" })} value={`${fmtAmount(q.cryptoAmount, q.cryptoSymbol, 6)}${q.network ? ` (${q.network})` : ""}`} />
        <Row label={t({ es: "Tipo de cambio", en: "Exchange rate" })} value={q.exchangeRate != null ? `1 ${q.cryptoSymbol} = ${fmtAmount(q.exchangeRate, fiat, 4)}` : "—"} />
        {q.grossFiatAmount != null && <Row label={t({ es: "Valor fiat estimado", en: "Estimated fiat value" })} value={fmtAmount(q.grossFiatAmount, fiat)} />}
        <Row label={t({ es: `Comisión de ${q.providerName}`, en: `${q.providerName} fee` })} value={fmtAmount(q.providerFee, fiat)} />
        {q.networkFee != null && Number(q.networkFee) > 0 && (
          <Row label={t({ es: "Comisión de red", en: "Network fee" })} value={fmtAmount(q.networkFee, fiat)} />
        )}
        <Row label={t({ es: "Comisión de Avec Pay", en: "Avec Pay fee" })} value={fmtAmount(q.avecpayFee ?? 0, fiat)} />
        <Row label={t({ es: "El destinatario recibe (estimado)", en: "Recipient gets (estimated)" })} value={fmtAmount(q.recipientAmount, fiat)} strong />
      </dl>
      <p className="mt-2 text-xs text-slate-500">
        {t({
          es: `Las tasas, comisiones y la moneda de pago vienen de ${q.providerName} y solo son definitivas cuando ${q.providerName} procesa la orden.`,
          en: `Rates, fees and payout currency come from ${q.providerName} and are final only when ${q.providerName} processes the order.`,
        })}
      </p>
    </div>
  );
}
