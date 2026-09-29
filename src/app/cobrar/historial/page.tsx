import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney } from "@/lib/cobros/parse";
import { METHOD_INFO, isMethod } from "@/lib/cobros/methods";

function badge(status: string, expired: boolean) {
  if (status === "paid") return <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">Pagado</span>;
  if (status === "cancelled") return <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">Cancelado</span>;
  if (expired) return <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">Vencido</span>;
  return <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Pendiente</span>;
}

export default async function HistorialPage() {
  const supabase = await createClient();
  const { data: merchant } = await supabase.from("merchants").select("id").maybeSingle();
  const { data: charges } = merchant
    ? await supabase
        .from("charges")
        .select("id, amount, currency, description, status, paid_method, payer_name, created_at, expires_at")
        .eq("merchant_id", merchant.id)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };
  const paidTotal = (charges ?? []).filter((c) => c.status === "paid").reduce((s, c) => s + Number(c.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Historial</h1>
        <Link href="/cobrar" className="btn-primary">Nuevo cobro</Link>
      </div>
      <div className="card">
        <p className="text-sm text-slate-500">Total cobrado (últimos 100)</p>
        <p className="text-3xl font-bold">{formatMoney(paidTotal)}</p>
      </div>
      {!charges?.length ? (
        <p className="card text-slate-600">Todavía no tienes cobros.</p>
      ) : (
        <ul className="space-y-3">
          {charges.map((c) => (
            <li key={c.id}>
              <Link href={`/cobrar/${c.id}`} className="card block hover:border-brand-ink">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-bold">{formatMoney(c.amount, c.currency)}</p>
                    <p className="truncate text-sm text-slate-600">
                      {c.status === "paid"
                        ? `${c.payer_name ?? "Cliente"} · ${isMethod(c.paid_method) ? METHOD_INFO[c.paid_method].short : ""}`
                        : (c.description ?? "Sin descripción")}
                    </p>
                    <p className="text-xs text-slate-500">{formatDateTime(c.created_at)}</p>
                  </div>
                  {badge(c.status, new Date(c.expires_at) < new Date())}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
