import { fmtAmount } from "@/lib/format";

export interface QuoteView {
  cryptoAmount: number | string | null;
  cryptoSymbol: string;
  network?: string | null;
  fiatCurrency: string | null;
  exchangeRate: number | string | null;
  grossFiatAmount?: number | string | null;
  providerFee: number | string | null;
  networkFee: number | string | null;
  avicpayFee: number | string | null;
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

export function QuoteBreakdown({ q, heading = "Estimate" }: { q: QuoteView; heading?: string }) {
  const fiat = q.fiatCurrency;
  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">{heading}</h3>
      <dl className="divide-y divide-slate-100">
        <Row label="You send" value={`${fmtAmount(q.cryptoAmount, q.cryptoSymbol, 6)}${q.network ? ` (${q.network})` : ""}`} />
        <Row label="Exchange rate" value={q.exchangeRate != null ? `1 ${q.cryptoSymbol} = ${fmtAmount(q.exchangeRate, fiat, 4)}` : "—"} />
        {q.grossFiatAmount != null && <Row label="Estimated fiat value" value={fmtAmount(q.grossFiatAmount, fiat)} />}
        <Row label={`${q.providerName} fee`} value={fmtAmount(q.providerFee, fiat)} />
        {q.networkFee != null && Number(q.networkFee) > 0 && (
          <Row label="Network fee" value={fmtAmount(q.networkFee, fiat)} />
        )}
        <Row label="AvicPay fee" value={fmtAmount(q.avicpayFee ?? 0, fiat)} />
        <Row label="Recipient gets (estimated)" value={fmtAmount(q.recipientAmount, fiat)} strong />
      </dl>
      <p className="mt-2 text-xs text-slate-500">
        Rates, fees and payout currency come from {q.providerName} and are final only when {q.providerName} processes
        the order.
      </p>
    </div>
  );
}
