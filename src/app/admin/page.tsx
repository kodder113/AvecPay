import { redirect } from "next/navigation";
import { loadBusiness } from "@/lib/business/context";
import { accessState } from "@/lib/business/access";
import { launchPricing } from "@/lib/business/billing";
import { PLANS, formatPrice, isPlanId } from "@/lib/business/plans";
import { formatMoney } from "@/lib/cobros/parse";
import { AdminPromoForm, AdminPromoToggle, AdminLaunchForm } from "@/components/business/AdminForms";

export const dynamic = "force-dynamic";

/** Avec's own admin: merchants, revenue, promo codes, launch pricing. */
export default async function AdminPage() {
  const ctx = await loadBusiness();
  if (!ctx.user) redirect("/login?next=/admin");
  if (!ctx.admin) redirect("/cobrar");
  const { db, t } = ctx;
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [{ data: merchants }, { data: owners }, { data: promos }, { data: fees }, launch] = await Promise.all([
    db
      .from("merchants")
      .select("id, business_name, plan, price_tier, subscription_status, access_until, past_due_since, stripe_account_id, stripe_charges_enabled, mode, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    db.from("merchant_members").select("merchant_id, email, role"),
    db.from("promo_codes").select("*").order("created_at", { ascending: false }).limit(200),
    db.from("charges").select("amount, tip_amount, platform_fee, paid_method").eq("status", "paid").eq("mode", "live").gte("paid_at", since).limit(10000),
    launchPricing(db),
  ]);

  const ownerOf = new Map((owners ?? []).filter((o) => o.role === "owner").map((o) => [o.merchant_id, o.email]));
  const seats = new Map<string, number>();
  for (const o of owners ?? []) seats.set(o.merchant_id, (seats.get(o.merchant_id) ?? 0) + 1);

  let mrrCents = 0;
  let active = 0;
  for (const m of merchants ?? []) {
    const a = accessState(m);
    if (a.ok) active++;
    if (m.subscription_status === "active" && isPlanId(m.plan)) mrrCents += PLANS[m.plan].cents[m.price_tier === "regular" ? "regular" : "launch"];
  }
  const cardVolume = (fees ?? []).filter((c) => c.paid_method === "card").reduce((s, c) => s + Number(c.amount) + Number(c.tip_amount ?? 0), 0);
  const feeTotal = (fees ?? []).reduce((s, c) => s + Number(c.platform_fee ?? 0), 0);

  const stat = (label: string, value: string) => (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-2xl font-black">{value}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Avec admin</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stat(t({ es: "Negocios activos", en: "Active businesses" }), `${active} / ${merchants?.length ?? 0}`)}
        {stat(t({ es: "Ingreso mensual (planes)", en: "Monthly revenue (plans)" }), formatPrice(mrrCents))}
        {stat(t({ es: "Tarjeta, 30 días", en: "Card volume, 30 days" }), formatMoney(cardVolume, "USD"))}
        {stat(t({ es: "Comisión Avec, 30 días", en: "Avec fees, 30 days" }), formatMoney(feeTotal, "USD"))}
      </div>

      <section className="card space-y-3">
        <h2 className="font-semibold">{t({ es: "Precio de lanzamiento", en: "Launch pricing" })}</h2>
        <p className="text-sm text-slate-600">
          {launch.on
            ? t({ es: "Activo: los negocios nuevos fijan el precio de lanzamiento de por vida.", en: "On: new businesses lock in launch prices for life." })
            : t({ es: "Apagado: los negocios nuevos pagan el precio regular.", en: "Off: new businesses pay regular prices." })}
        </p>
        <AdminLaunchForm on={launch.on} until={launch.until} />
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">{t({ es: "Crear código", en: "Create a code" })}</h2>
        <AdminPromoForm />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">{t({ es: "Códigos", en: "Codes" })}</h2>
        {!promos?.length ? (
          <p className="card text-sm text-slate-600">{t({ es: "Aún no hay códigos.", en: "No codes yet." })}</p>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">{t({ es: "Tipo", en: "Type" })}</th>
                  <th className="px-3 py-2">{t({ es: "Da", en: "Gives" })}</th>
                  <th className="px-3 py-2">{t({ es: "Usos", en: "Uses" })}</th>
                  <th className="px-3 py-2">{t({ es: "Nota", en: "Note" })}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {promos.map((p) => (
                  <tr key={p.code} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-mono font-semibold">{p.code}</td>
                    <td className="px-3 py-2">{p.kind}</td>
                    <td className="px-3 py-2">
                      {p.kind === "activation" && `${PLANS[p.plan as keyof typeof PLANS]?.name} · ${p.months} mo`}
                      {p.kind === "trial" && `${PLANS[p.plan as keyof typeof PLANS]?.name} · ${p.days} days free`}
                      {p.kind === "discount" && `${p.percent_off}% off${p.months ? ` · ${p.months} mo` : ""}`}
                    </td>
                    <td className="px-3 py-2">
                      {p.used_count}
                      {p.max_uses ? ` / ${p.max_uses}` : ""}
                    </td>
                    <td className="max-w-[12rem] truncate px-3 py-2 text-slate-500">{p.note}</td>
                    <td className="px-3 py-2 text-right">
                      <AdminPromoToggle code={p.code} active={p.active} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">{t({ es: "Negocios", en: "Businesses" })}</h2>
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">{t({ es: "Negocio", en: "Business" })}</th>
                <th className="px-3 py-2">{t({ es: "Dueño", en: "Owner" })}</th>
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">{t({ es: "Estado", en: "Status" })}</th>
                <th className="px-3 py-2">{t({ es: "Usuarios", en: "Users" })}</th>
                <th className="px-3 py-2">Stripe</th>
              </tr>
            </thead>
            <tbody>
              {(merchants ?? []).map((m) => {
                const a = accessState(m);
                return (
                  <tr key={m.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium">{m.business_name}</td>
                    <td className="px-3 py-2 text-slate-600">{ownerOf.get(m.id) ?? "—"}</td>
                    <td className="px-3 py-2">
                      {isPlanId(m.plan) ? PLANS[m.plan].name : "—"}
                      {m.price_tier === "launch" && <span className="ml-1 text-xs text-amber-700">launch</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={a.ok ? "text-emerald-700" : "text-red-600"}>{m.subscription_status}</span>
                      {m.access_until && <span className="ml-1 text-xs text-slate-500">→ {m.access_until.slice(0, 10)}</span>}
                    </td>
                    <td className="px-3 py-2">{seats.get(m.id) ?? 1}</td>
                    <td className="px-3 py-2">{m.stripe_charges_enabled ? "✓" : m.stripe_account_id ? "pending" : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
