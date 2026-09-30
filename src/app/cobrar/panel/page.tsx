import Link from "next/link";
import { loadBusiness, seesAllCharges } from "@/lib/business/context";
import { memberNames } from "@/lib/business/members";
import { hasFeature, planWith, PLANS } from "@/lib/business/plans";
import { change, computeStats, type StatCharge } from "@/lib/business/insights";
import { gatePage, SharingBanner } from "@/components/business/Gate";
import { DailyChart } from "@/components/business/DailyChart";
import { AiPanel, RemindButton } from "@/components/business/DashboardActions";
import { ModePill } from "@/components/cobros/DemoPill";
import { formatDateTime, formatMoney } from "@/lib/cobros/parse";
import { METHOD_ICON, isMethod, methodInfo } from "@/lib/cobros/methods";
import { aiConfigured } from "@/lib/ai/claude";
import { emailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

/** Sales at a glance: totals, per day, per method, per employee, unpaid tickets, AI. */
export default async function DashboardPage() {
  const ctx = await loadBusiness();
  const gate = gatePage(ctx);
  if (gate) return gate;
  const { db, t, lang, user } = ctx;
  const business = ctx.business!;
  const m = business.merchant;
  const lead = seesAllCharges(business.role);

  let q = db
    .from("charges")
    .select("id, amount, tip_amount, tip_only, status, paid_method, paid_at, created_at, created_by, kind, platform_fee, ticket_ref, customer_name, customer_email, reminders_sent, currency")
    .eq("merchant_id", m.id)
    .eq("mode", m.mode)
    .gte("created_at", new Date(Date.now() - 45 * 86_400_000).toISOString())
    .limit(10000);
  if (!lead) q = q.eq("created_by", user!.id);
  const [{ data }, names, { data: reports }] = await Promise.all([
    q,
    memberNames(db, m.id),
    hasFeature(m.plan, "ai") && lead
      ? db.from("ai_reports").select("kind, question, answer, created_at").eq("merchant_id", m.id).order("created_at", { ascending: false }).limit(10)
      : Promise.resolve({ data: [] as { kind: string; question: string | null; answer: string; created_at: string }[] }),
  ]);
  const charges = (data ?? []) as (StatCharge & { id: string; ticket_ref: string | null; customer_name: string | null; customer_email: string | null; reminders_sent: number })[];
  const s = computeStats(charges);
  const cur = m.currency;
  const weekChange = change(s.week.total, s.prevWeek.total);
  const info = methodInfo(lang);
  const unpaid = charges
    .filter((c) => c.kind === "ticket" && (c.status === "pending" || c.status === "reported"))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const unpaidTotal = unpaid.reduce((sum, c) => sum + Number(c.amount), 0);
  const weekly = reports?.find((r) => r.kind === "weekly");

  const tile = (label: string, value: string, sub?: React.ReactNode) => (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-2xl font-black">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );

  return (
    <div className="space-y-4">
      <SharingBanner ctx={ctx} />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="space-y-1">
          <ModePill mode={m.mode} />
          <h1 className="text-2xl font-bold">{lead ? t({ es: "Panel", en: "Dashboard" }) : t({ es: "Mis ventas", en: "My sales" })}</h1>
        </div>
        {lead && hasFeature(m.plan, "csv") && (
          <a href="/api/cobros/export?days=90" className="btn-secondary py-2 text-sm">
            ⬇ {t({ es: "Exportar CSV", en: "Export CSV" })}
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tile(t({ es: "Hoy", en: "Today" }), formatMoney(s.today.total, cur), t({ es: `${s.today.count} pagos`, en: `${s.today.count} payments` }))}
        {tile(
          t({ es: "Últimos 7 días", en: "Last 7 days" }),
          formatMoney(s.week.total, cur),
          weekChange === null ? t({ es: "sin semana anterior", en: "no previous week" }) : (
            <span className={weekChange >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-red-600"}>
              {weekChange >= 0 ? "▲" : "▼"} {Math.abs(weekChange)}% {t({ es: "vs semana anterior", en: "vs previous week" })}
            </span>
          ),
        )}
        {tile(t({ es: "Venta promedio (30 días)", en: "Average sale (30 days)" }), formatMoney(s.month.avg, cur), t({ es: "sin propinas", en: "tips excluded" }))}
        {tile(t({ es: "Propinas (30 días)", en: "Tips (30 days)" }), formatMoney(s.month.tips, cur), t({ es: `total 30 días ${formatMoney(s.month.total, cur)}`, en: `30-day total ${formatMoney(s.month.total, cur)}` }))}
      </div>

      <DailyChart days={s.daily} currency={cur} />

      {lead && hasFeature(m.plan, "ai") && (
        <AiPanel
          ready={aiConfigured()}
          report={weekly?.answer ?? null}
          reportDate={weekly ? formatDateTime(weekly.created_at, lang) : null}
          history={(reports ?? []).filter((r) => r.kind === "question").slice(0, 2).map((r) => ({ q: r.question ?? "", a: r.answer }))}
        />
      )}
      {lead && !hasFeature(m.plan, "ai") && business.role === "owner" && (
        <Link href="/cobrar/plan" className="card block border-dashed text-sm text-slate-600 hover:border-brand-ink">
          ✨ {t({ es: `Reporte semanal con IA, preguntas y recordatorios de tickets: plan ${PLANS[planWith("ai")].name}.`, en: `Weekly AI report, questions and ticket reminders: ${PLANS[planWith("ai")].name} plan.` })}
        </Link>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card space-y-2">
          <h2 className="font-semibold">{t({ es: "Cómo te pagan (30 días)", en: "How you get paid (30 days)" })}</h2>
          {!s.methods.length ? (
            <p className="text-sm text-slate-500">{t({ es: "Todavía no hay pagos.", en: "No payments yet." })}</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {s.methods.map((x) => (
                  <tr key={x.method} className="border-t border-slate-100 first:border-0">
                    <td className="py-2">
                      {isMethod(x.method) ? `${METHOD_ICON[x.method]} ${info[x.method].short}` : x.method}
                    </td>
                    <td className="py-2 text-right text-slate-500">{x.count}</td>
                    <td className="py-2 text-right font-semibold">{formatMoney(x.total, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {s.cardFees > 0 && lead && <p className="text-xs text-slate-500">{t({ es: `Comisión Avec en tarjetas: ${formatMoney(s.cardFees, cur)}`, en: `Avec card fees: ${formatMoney(s.cardFees, cur)}` })}</p>}
        </section>

        {lead && hasFeature(m.plan, "per_employee") && (
          <section className="card space-y-2">
            <h2 className="font-semibold">{t({ es: "Por empleado (30 días)", en: "By employee (30 days)" })}</h2>
            {!s.members.length ? (
              <p className="text-sm text-slate-500">{t({ es: "Todavía no hay pagos.", en: "No payments yet." })}</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="pb-1 font-medium">{t({ es: "Quién", en: "Who" })}</th>
                    <th className="pb-1 text-right font-medium">{t({ es: "Ventas", en: "Sales" })}</th>
                    <th className="pb-1 text-right font-medium">{t({ es: "Propinas", en: "Tips" })}</th>
                    <th className="pb-1 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {s.members.map((x) => (
                    <tr key={x.userId ?? "none"} className="border-t border-slate-100">
                      <td className="py-2">{x.userId ? (names.get(x.userId) ?? t({ es: "Ex empleado", en: "Former member" })) : t({ es: "QR del negocio", en: "Business QR" })}</td>
                      <td className="py-2 text-right text-slate-500">{x.count}</td>
                      <td className="py-2 text-right">{formatMoney(x.tips, cur)}</td>
                      <td className="py-2 text-right font-semibold">{formatMoney(x.total, cur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}
      </div>

      {hasFeature(m.plan, "ticket_qr") && (
        <section className="card space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-semibold">{t({ es: "Tickets sin pagar", en: "Unpaid tickets" })}</h2>
            <span className="text-sm font-semibold">{formatMoney(unpaidTotal, cur)}</span>
          </div>
          {!unpaid.length ? (
            <p className="text-sm text-slate-500">{t({ es: "Nada pendiente. 🎉", en: "Nothing outstanding. 🎉" })}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {unpaid.slice(0, 20).map((c) => {
                const days = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86_400_000);
                return (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <Link href={`/cobrar/${c.id}`} className="min-w-0">
                      <span className="font-semibold">#{c.ticket_ref}</span> {c.customer_name && <span className="text-slate-600">· {c.customer_name}</span>}
                      <span className="block text-xs text-slate-500">
                        {formatMoney(c.amount, cur)} · {days === 0 ? t({ es: "hoy", en: "today" }) : t({ es: `hace ${days} días`, en: `${days} days ago` })}
                        {c.created_by && lead && <> · {names.get(c.created_by)}</>}
                      </span>
                    </Link>
                    {hasFeature(m.plan, "unpaid_tickets") && c.customer_email && c.status === "pending" && emailConfigured() && <RemindButton id={c.id} sent={c.reminders_sent} />}
                  </li>
                );
              })}
            </ul>
          )}
          {!hasFeature(m.plan, "unpaid_tickets") && business.role === "owner" && (
            <p className="text-xs text-slate-500">{t({ es: "Recordatorios automáticos por correo: plan Business.", en: "Automatic email reminders: Business plan." })}</p>
          )}
        </section>
      )}
    </div>
  );
}
