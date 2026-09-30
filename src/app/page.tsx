import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { launchPricing } from "@/lib/business/billing";
import { PLAN_IDS, PLANS, formatPrice } from "@/lib/business/plans";

export const dynamic = "force-dynamic";

/** Public landing page for merchants: what Avec does, how it works, pricing. */
export default async function Home() {
  const { t } = await getT();
  const launch = (await launchPricing(createAdminClient())).on;
  const tier = launch ? "launch" : "regular";
  const start = `/login?next=${encodeURIComponent("/cobrar")}`;

  const steps = [
    {
      icon: "🔢",
      title: t({ es: "Escribe el monto", en: "Type the amount" }),
      body: t({ es: "En tu teléfono, en segundos. O usa tu QR impreso y el cliente lo escribe.", en: "On your phone, in seconds. Or use your printed QR and the customer types it." }),
    },
    {
      icon: "📱",
      title: t({ es: "El cliente escanea", en: "Customer scans" }),
      body: t({ es: "Paga con tarjeta, Apple Pay, Google Pay, Zelle, Venmo o Cash App. Sin app ni cuenta.", en: "Pays with card, Apple Pay, Google Pay, Zelle, Venmo or Cash App. No app, no account." }),
    },
    {
      icon: "✅",
      title: t({ es: "Tu pantalla se pone verde", en: "Your screen turns green" }),
      body: t({ es: "El dinero va directo a tu cuenta. Avec nunca lo toca.", en: "Money goes straight to your account. Avec never touches it." }),
    },
  ];

  const features = [
    { icon: "🧾", title: t({ es: "Tickets y facturas", en: "Tickets & invoices" }), body: t({ es: "Un QR por trabajo, con número de ticket, que queda abierto por días. Búscalo después por número.", en: "One QR per job, with the ticket number, open for days. Find it later by number." }) },
    { icon: "🚚", title: t({ es: "Técnicos en la calle", en: "Techs in the field" }), body: t({ es: "Cada técnico cobra desde su teléfono con su propio acceso y QR. Tú ves quién cobró qué.", en: "Each tech charges from their phone with their own login and QR. You see who collected what." }) },
    { icon: "💛", title: t({ es: "Propinas", en: "Tips" }), body: t({ es: "10/15/20% en cada cobro, y un QR de propinas para el mostrador o la camioneta. Sin comisión de Avec.", en: "10/15/20% on every charge, plus a tip QR for the counter or truck. No Avec fee on tips." }) },
    { icon: "🖨️", title: t({ es: "QR permanente", en: "Permanent QR" }), body: t({ es: "Imprime tu QR una vez. No vence: el cliente escribe el monto y paga.", en: "Print your QR once. It never expires: the customer types the amount and pays." }) },
    { icon: "⏰", title: t({ es: "Cobra lo pendiente", en: "Collect what's owed" }), body: t({ es: "Recordatorios por correo con el enlace de pago a los 3 y 7 días.", en: "Email reminders with the pay link at 3 and 7 days." }) },
    { icon: "✨", title: t({ es: "Tus números con IA", en: "Your numbers, with AI" }), body: t({ es: "Un resumen cada lunes y respuestas a preguntas como “¿cuánto cobró Miguel este mes?”", en: "A summary every Monday and answers to questions like “how much did Miguel collect this month?”" }) },
  ];

  return (
    <div className="space-y-10">
      <section className="space-y-5 rounded-3xl bg-brand-ink p-6 text-white sm:p-10">
        <p className="inline-block rounded-full bg-brand-yellow px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-ink">
          {t({ es: "Cobros con QR para negocios de servicio", en: "QR payments for service businesses" })}
        </p>
        <h1 className="text-3xl font-black italic leading-tight sm:text-5xl">{t({ es: "Cobra con un QR. El dinero llega directo a ti.", en: "Get paid with a QR. Money goes straight to you." })}</h1>
        <p className="max-w-xl text-lg text-slate-300">
          {t({
            es: "Tarjeta, Apple Pay, Google Pay, Zelle, Venmo y Cash App, sin terminal ni hardware. Para el mostrador, la camioneta y cada técnico de tu equipo.",
            en: "Card, Apple Pay, Google Pay, Zelle, Venmo and Cash App, with no terminal or hardware. For the counter, the truck and every tech on your team.",
          })}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href={start} className="btn-primary px-6 py-4 text-base">
            {t({ es: `Empieza por ${formatPrice(PLANS.starter.cents[tier])}/mes`, en: `Start for ${formatPrice(PLANS.starter.cents[tier])}/mo` })}
          </Link>
          <a href="#precios" className="rounded-xl border border-white/30 px-6 py-4 text-base font-semibold">
            {t({ es: "Ver precios", en: "See pricing" })}
          </a>
        </div>
        <p className="text-sm text-slate-400">{t({ es: "En inglés y español. Cancela cuando quieras.", en: "In English and Spanish. Cancel anytime." })}</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">{t({ es: "Así de simple", en: "That simple" })}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {steps.map((s, i) => (
            <div key={i} className="card space-y-1">
              <p className="text-3xl">{s.icon}</p>
              <p className="font-bold">
                {i + 1}. {s.title}
              </p>
              <p className="text-sm text-slate-600">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">{t({ es: "Hecho para negocios con equipo", en: "Built for businesses with a crew" })}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="card flex gap-3">
              <span className="text-2xl">{f.icon}</span>
              <div>
                <p className="font-bold">{f.title}</p>
                <p className="text-sm text-slate-600">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card space-y-2 border-2 border-emerald-300 bg-emerald-50">
        <h2 className="text-xl font-bold">{t({ es: "Tu dinero es tuyo", en: "Your money stays yours" })}</h2>
        <p className="text-slate-700">
          {t({
            es: "Los pagos con tarjeta van a tu propia cuenta de Stripe y de ahí a tu banco. Zelle, Venmo y Cash App llegan directo a ti. Avec es el software; nunca retiene tu dinero.",
            en: "Card payments go to your own Stripe account and on to your bank. Zelle, Venmo and Cash App come straight to you. Avec is the software; it never holds your money.",
          })}
        </p>
      </section>

      <section id="precios" className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold">{t({ es: "Precios", en: "Pricing" })}</h2>
          {launch && (
            <p className="mt-1 inline-block rounded-full bg-brand-yellow px-3 py-1 text-sm font-bold text-brand-ink">
              {t({ es: "Precio de lanzamiento, fijo de por vida", en: "Launch price, locked for life" })}
            </p>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {PLAN_IDS.map((p) => {
            const plan = PLANS[p];
            return (
              <div key={p} className={`card flex flex-col gap-3 ${p === "team" ? "border-2 border-brand-ink" : ""}`}>
                <div>
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                  <p className="text-sm text-slate-500">{t(plan.blurb)}</p>
                </div>
                <p>
                  <span className="text-3xl font-black">{formatPrice(plan.cents[tier])}</span>
                  <span className="text-slate-500">{t({ es: "/mes", en: "/mo" })}</span>
                  {launch && <span className="ml-2 text-sm text-slate-400 line-through">{formatPrice(plan.cents.regular)}</span>}
                </p>
                <ul className="flex-1 space-y-1 text-sm text-slate-700">
                  {plan.bullets.map((bullet, i) => (
                    <li key={i}>✓ {t(bullet)}</li>
                  ))}
                </ul>
                <Link href={start} className={p === "team" ? "btn-primary" : "btn-secondary"}>
                  {t({ es: `Empezar con ${plan.name}`, en: `Start with ${plan.name}` })}
                </Link>
              </div>
            );
          })}
        </div>
        <p className="text-sm text-slate-500">
          {t({
            es: "Pagos con tarjeta: la tarifa de Stripe más 0.5% de Avec (nunca en propinas). Zelle, Venmo, Cash App y PayPal: sin comisión de Avec.",
            en: "Card payments: Stripe's fee plus a 0.5% Avec fee (never on tips). Zelle, Venmo, Cash App and PayPal: no Avec fee.",
          })}
        </p>
      </section>

      <footer className="flex flex-wrap gap-4 border-t border-slate-200 pt-6 text-sm text-slate-500">
        <Link href="/terms">{t({ es: "Términos", en: "Terms" })}</Link>
        <Link href="/privacy">{t({ es: "Privacidad", en: "Privacy" })}</Link>
        <Link href="/usdt">{t({ es: "Enviar USDT al extranjero", en: "Send USDT abroad" })}</Link>
        <span className="ml-auto">© {new Date().getFullYear()} Avec Pay</span>
      </footer>
    </div>
  );
}
