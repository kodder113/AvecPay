import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtAmount, fmtDate } from "@/lib/format";
import type { TransferStatus } from "@/lib/status";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: transfers, error } = await supabase
    .from("transfers")
    .select("id, status, crypto_amount, crypto_currency_code, est_fiat_amount, est_fiat_currency, final_fiat_amount, final_fiat_currency, created_at, recipients(full_name, country_code)")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transfers</h1>
        <Link href="/send" className="btn-primary">
          Send money
        </Link>
      </div>
      {error && <p className="card text-sm text-red-600">{error.message}</p>}
      {!transfers?.length ? (
        <p className="card text-slate-600">No transfers yet.</p>
      ) : (
        <ul className="space-y-3">
          {transfers.map((t) => {
            const r = (Array.isArray(t.recipients) ? t.recipients[0] : t.recipients) as { full_name: string; country_code: string } | null;
            const fiatAmount = t.final_fiat_amount ?? t.est_fiat_amount;
            const fiatCurrency = t.final_fiat_currency ?? t.est_fiat_currency;
            return (
              <li key={t.id}>
                <Link href={`/transfers/${t.id}`} className="card block hover:border-brand-ink">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{r?.full_name ?? "Recipient"}</p>
                      <p className="text-xs text-slate-500">
                        {r?.country_code} · {fmtDate(t.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={t.status as TransferStatus} />
                  </div>
                  <p className="mt-2 text-sm">
                    {fmtAmount(t.crypto_amount, "USDT", 6)} → {t.final_fiat_amount != null ? "" : "~"}
                    {fmtAmount(fiatAmount, fiatCurrency)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
