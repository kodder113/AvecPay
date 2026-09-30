"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PLAN_IDS, PLANS, formatPrice, type PlanId, type PriceTier } from "@/lib/business/plans";
import { formatDateTime } from "@/lib/cobros/parse";
import { useLang, useT } from "@/components/i18n/LangProvider";

interface Current {
  plan: PlanId | null;
  status: string;
  accessOk: boolean;
  accessReason: string;
  until: string | null;
  cancelAtPeriodEnd: boolean;
  hasSubscription: boolean;
  hasCustomer: boolean;
  lockedTier: PriceTier | null;
}

interface Props {
  tier: PriceTier;
  launchUntil: string | null;
  justPaid: boolean;
  billingReady: boolean;
  seatsUsed: number;
  current: Current;
}

/** Plan cards, code box, and plan management for the owner. */
export function PlanPicker({ tier, launchUntil, justPaid, billingReady, seatsUsed, current }: Props) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState<{ code: string; percentOff: number; months: number | null } | null>(null);
  const paid = current.hasSubscription && current.status === "active";

  // Back from Stripe: the webhook activates the plan within seconds.
  useEffect(() => {
    if (!justPaid || current.accessOk) return;
    const timer = setInterval(() => router.refresh(), 2500);
    return () => clearInterval(timer);
  }, [justPaid, current.accessOk, router]);

  async function post(path: string, body: unknown, key: string): Promise<Record<string, unknown> | null> {
    setBusy(key);
    setError(null);
    setNotice(null);
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    setBusy(null);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : t({ es: "Algo salió mal. Intenta de nuevo.", en: "Something went wrong. Try again." }));
      return null;
    }
    return data;
  }

  async function subscribe(plan: PlanId) {
    const data = await post("/api/billing/checkout", { plan, code: discount?.code }, `sub-${plan}`);
    if (data?.url) {
      setBusy(`sub-${plan}`);
      window.location.assign(String(data.url));
    }
  }

  async function change(plan: PlanId) {
    if (await post("/api/billing/change", { plan }, `chg-${plan}`)) {
      setNotice(t({ es: `Listo: ahora tienes el plan ${PLANS[plan].name}.`, en: `Done: you're now on the ${PLANS[plan].name} plan.` }));
      router.refresh();
    }
  }

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    const data = await post("/api/billing/redeem", { code }, "redeem");
    if (!data) return;
    if (data.kind === "discount") {
      setDiscount({ code: String(data.code), percentOff: Number(data.percentOff), months: data.months ? Number(data.months) : null });
      setNotice(t({ es: `Código aplicado: ${data.percentOff}% de descuento al pagar.`, en: `Code applied: ${data.percentOff}% off at checkout.` }));
    } else {
      setNotice(
        data.kind === "trial"
          ? t({ es: `¡Prueba gratis activada por ${data.days} días!`, en: `Free trial on for ${data.days} days!` })
          : t({ es: `¡Plan activado por ${data.months} meses!`, en: `Plan activated for ${data.months} months!` }),
      );
      setCode("");
      router.refresh();
    }
  }

  async function portal() {
    const data = await post("/api/billing/portal", {}, "portal");
    if (data?.url) window.location.assign(String(data.url));
  }

  async function setCancel(cancel: boolean) {
    if (await post("/api/billing/cancel", { cancel }, "cancel")) router.refresh();
  }

  const date = (iso: string | null) => (iso ? formatDateTime(iso, lang).replace(/,? \d{1,2}:\d{2}.*$/, "") : "");
  const priceOf = (p: PlanId, tr: PriceTier = tier) => formatPrice(PLANS[p].cents[tr]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t({ es: "Tu plan de Avec", en: "Your Avec plan" })}</h1>
        {tier === "launch" && !current.lockedTier && (
          <p className="mt-1 inline-block rounded-full bg-brand-yellow px-3 py-1 text-sm font-bold text-brand-ink">
            {t({ es: "Precio de lanzamiento, fijo de por vida", en: "Launch price, locked for life" })}
            {launchUntil && <> · {t({ es: `hasta ${date(launchUntil)}`, en: `until ${date(launchUntil)}` })}</>}
          </p>
        )}
      </div>

      {justPaid && !current.accessOk && (
        <p className="card animate-pulse text-center text-slate-700">{t({ es: "Pago recibido. Activando tu plan…", en: "Payment received. Activating your plan…" })}</p>
      )}

      {current.plan && current.accessOk && <CurrentPlan current={current} priceOf={priceOf} date={date} />}

      {notice && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{notice}</p>}
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!billingReady && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          {t({ es: "Los pagos con tarjeta de los planes aún no están activos. Puedes activar tu plan con un código.", en: "Card payments for plans aren't on yet. You can activate your plan with a code." })}
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        {PLAN_IDS.map((p) => {
          const plan = PLANS[p];
          const isCurrent = current.plan === p && current.accessOk;
          const tooSmall = seatsUsed > plan.seats;
          return (
            <div key={p} className={`card flex flex-col gap-3 ${p === "team" ? "border-2 border-brand-ink" : ""}`}>
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">{plan.name}</h2>
                  {p === "team" && <span className="rounded-full bg-brand-ink px-2 py-0.5 text-xs font-bold text-white">{t({ es: "Popular", en: "Popular" })}</span>}
                </div>
                <p className="text-sm text-slate-500">{t(plan.blurb)}</p>
              </div>
              <p>
                <span className="text-3xl font-black">{priceOf(p)}</span>
                <span className="text-slate-500">{t({ es: "/mes", en: "/mo" })}</span>
                {tier === "launch" && <span className="ml-2 text-sm text-slate-400 line-through">{priceOf(p, "regular")}</span>}
              </p>
              <ul className="flex-1 space-y-1 text-sm text-slate-700">
                {plan.bullets.map((b, i) => (
                  <li key={i}>✓ {t(b)}</li>
                ))}
              </ul>
              {isCurrent ? (
                <p className="rounded-xl bg-slate-100 py-3 text-center text-sm font-semibold">{t({ es: "Tu plan actual", en: "Your current plan" })}</p>
              ) : paid ? (
                <button type="button" className="btn-secondary w-full" disabled={Boolean(busy) || tooSmall} onClick={() => change(p)}>
                  {busy === `chg-${p}` ? t({ es: "Cambiando…", en: "Switching…" }) : t({ es: `Cambiar a ${plan.name}`, en: `Switch to ${plan.name}` })}
                </button>
              ) : (
                <button type="button" className="btn-primary w-full" disabled={Boolean(busy) || tooSmall || !billingReady} onClick={() => subscribe(p)}>
                  {busy === `sub-${p}` ? t({ es: "Abriendo pago…", en: "Opening checkout…" }) : t({ es: `Elegir ${plan.name}`, en: `Choose ${plan.name}` })}
                </button>
              )}
              {tooSmall && <p className="text-xs text-slate-500">{t({ es: `Tienes ${seatsUsed} usuarios; este plan permite ${plan.seats}.`, en: `You have ${seatsUsed} users; this plan allows ${plan.seats}.` })}</p>}
            </div>
          );
        })}
      </div>
      <p className="text-center text-xs text-slate-500">
        {t({
          es: "Más una comisión de Avec de 0.5% en pagos con tarjeta (nunca en propinas). Zelle, Venmo, Cash App y PayPal sin comisión de Avec. Cancela cuando quieras.",
          en: "Plus a 0.5% Avec fee on card payments (never on tips). Zelle, Venmo, Cash App and PayPal have no Avec fee. Cancel anytime.",
        })}
      </p>

      {!paid && (
        <form onSubmit={redeem} className="card space-y-2">
          <label className="label" htmlFor="code">{t({ es: "¿Tienes un código?", en: "Have a code?" })}</label>
          <div className="flex gap-2">
            <input id="code" className="input uppercase" value={code} onChange={(e) => setCode(e.target.value)} placeholder="MSA2026" autoCapitalize="characters" maxLength={40} />
            <button className="btn-secondary shrink-0" disabled={!code.trim() || busy === "redeem"}>
              {busy === "redeem" ? "…" : t({ es: "Aplicar", en: "Apply" })}
            </button>
          </div>
          <p className="text-xs text-slate-500">
            {t({ es: "Códigos de activación (pagado en persona), prueba gratis o descuento.", en: "Activation (paid in person), free trial or discount codes." })}
          </p>
        </form>
      )}

      {current.hasCustomer && (
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-secondary" disabled={Boolean(busy)} onClick={portal}>
            {t({ es: "Tarjeta y facturas", en: "Card and invoices" })}
          </button>
          {current.hasSubscription &&
            (current.cancelAtPeriodEnd ? (
              <button type="button" className="btn-secondary" disabled={Boolean(busy)} onClick={() => setCancel(false)}>
                {t({ es: "Seguir con mi plan", en: "Keep my plan" })}
              </button>
            ) : (
              <button type="button" className="text-sm text-slate-500 underline" disabled={Boolean(busy)} onClick={() => setCancel(true)}>
                {t({ es: "Cancelar al final del mes", en: "Cancel at end of month" })}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

function CurrentPlan({ current, priceOf, date }: { current: Current; priceOf: (p: PlanId, tr?: PriceTier) => string; date: (iso: string | null) => string }) {
  const t = useT();
  const plan = PLANS[current.plan!];
  let line: string;
  switch (current.accessReason) {
    case "comped":
      line = current.until ? t({ es: `Activo hasta el ${date(current.until)} (código).`, en: `Active until ${date(current.until)} (code).` }) : t({ es: "Activo.", en: "Active." });
      break;
    case "trial":
      line = t({ es: `Prueba gratis hasta el ${date(current.until)}.`, en: `Free trial until ${date(current.until)}.` });
      break;
    case "grace":
      line = t({ es: `No pudimos cobrar tu tarjeta. Actualízala antes del ${date(current.until)}.`, en: `We couldn't charge your card. Update it before ${date(current.until)}.` });
      break;
    default:
      line = current.cancelAtPeriodEnd
        ? t({ es: `Se cancela el ${date(current.until)}.`, en: `Ends on ${date(current.until)}.` })
        : t({ es: `Se renueva el ${date(current.until)}.`, en: `Renews on ${date(current.until)}.` });
  }
  return (
    <div className="card flex items-center justify-between gap-3 border-emerald-300 bg-emerald-50">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">{t({ es: "Plan activo", en: "Active plan" })}</p>
        <p className="text-xl font-bold">
          {plan.name} · {priceOf(plan.id, current.lockedTier ?? undefined)}
          {t({ es: "/mes", en: "/mo" })}
        </p>
        <p className="text-sm text-slate-600">{line}</p>
        {!current.hasSubscription && current.until && (
          <p className="mt-1 text-xs text-slate-500">
            {t({ es: "Elige tu plan abajo para seguir después de esa fecha; no se cobra antes.", en: "Choose your plan below to continue after that date; nothing is charged before." })}
          </p>
        )}
      </div>
      <span className="text-3xl">✓</span>
    </div>
  );
}
