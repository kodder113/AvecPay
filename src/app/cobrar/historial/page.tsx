import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney } from "@/lib/cobros/parse";
import { methodInfo, isMethod } from "@/lib/cobros/methods";
import { addMoney } from "@/lib/cobros/tip";
import { getT } from "@/lib/i18n/server";
import type { T } from "@/lib/i18n";

function badge(status: string, expired: boolean, t: T) {
  if (status === "paid") return <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">{t({ es: "Pagado", en: "Paid" })}</span>;
  if (status === "reported") return <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">{t({ es: "Por confirmar", en: "To confirm" })}</span>;
  if (status === "cancelled") return <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{t({ es: "Cancelado", en: "Cancelled" })}</span>;
  if (expired) return <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{t({ es: "Vencido", en: "Expired" })}</span>;
  return <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">{t({ es: "Pendiente", en: "Pending" })}</span>;
}

export default async function HistorialPage() {
  const { lang, t } = await getT();
  const supabase = await createClient();
  const { data: merchant } = await supabase.from("merchants").select("id").maybeSingle();
  const { data: charges } = merchant
    ? await supabase
        .from("charges")
        .select("id, amount, tip_amount, currency, mode, description, status, paid_method, payer_name, created_at, expires_at")
        .eq("merchant_id", merchant.id)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };
  const paid = (charges ?? []).filter((c) => c.status === "paid");
  // Real money and play money, and each currency, are totalled separately.
  const totals = new Map<string, { mode: string; currency: string; total: number; tips: number }>();
  for (const c of paid) {
    const key = `${c.mode}:${c.currency}`;
    const row = totals.get(key) ?? { mode: c.mode, currency: c.currency, total: 0, tips: 0 };
    row.total = addMoney(row.total, addMoney(c.amount, c.tip_amount ?? 0));
    row.tips = addMoney(row.tips, c.tip_amount ?? 0);
    totals.set(key, row);
  }
  const totalRows = [...totals.values()].sort((a, b) => (a.mode === b.mode ? 0 : a.mode === "live" ? -1 : 1));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t({ es: "Historial", en: "History" })}</h1>
        <Link href="/cobrar" className="btn-primary">{t({ es: "Nuevo cobro", en: "New charge" })}</Link>
      </div>
      <div className="card">
        <p className="text-sm text-slate-500">{t({ es: "Total cobrado (últimos 100)", en: "Total collected (last 100)" })}</p>
        {totalRows.length === 0 && <p className="text-3xl font-bold">—</p>}
        {totalRows.map((row) => (
          <div key={`${row.mode}:${row.currency}`} className="mt-1">
            <p className="text-3xl font-bold">
              {formatMoney(row.total, row.currency)}
              {row.mode !== "live" && <span className="ml-2 align-middle text-sm font-semibold text-amber-700">{t({ es: "demo", en: "demo" })}</span>}
            </p>
            {row.tips > 0 && (
              <p className="text-sm text-slate-600">
                {t({ es: `incluye ${formatMoney(row.tips, row.currency)} en propinas`, en: `includes ${formatMoney(row.tips, row.currency)} in tips` })}
              </p>
            )}
          </div>
        ))}
      </div>
      {!charges?.length ? (
        <p className="card text-slate-600">{t({ es: "Todavía no tienes cobros.", en: "You don’t have any charges yet." })}</p>
      ) : (
        <ul className="space-y-3">
          {charges.map((c) => (
            <li key={c.id}>
              <Link href={`/cobrar/${c.id}`} className="card block hover:border-brand-ink">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-bold">
                      {formatMoney(addMoney(c.amount, c.tip_amount ?? 0), c.currency)}
                      {Number(c.tip_amount) > 0 && <span className="ml-2 text-xs font-medium text-emerald-700">+{formatMoney(c.tip_amount, c.currency)} {t({ es: "propina", en: "tip" })}</span>}
                    </p>
                    <p className="truncate text-sm text-slate-600">
                      {c.status === "paid"
                        ? `${c.payer_name ?? t({ es: "Cliente", en: "Customer" })} · ${isMethod(c.paid_method) ? methodInfo(lang)[c.paid_method].short : ""}`
                        : (c.description ?? t({ es: "Sin descripción", en: "No description" }))}
                    </p>
                    <p className="text-xs text-slate-500">{formatDateTime(c.created_at, lang)}</p>
                  </div>
                  {badge(c.status, new Date(c.expires_at) < new Date(), t)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
