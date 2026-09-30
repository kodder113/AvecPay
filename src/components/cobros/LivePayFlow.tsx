"use client";
import { useCallback, useEffect, useState } from "react";
import { formatMoney } from "@/lib/cobros/parse";
import { addMoney } from "@/lib/cobros/tip";
import { METHOD_ICON, methodInfo } from "@/lib/cobros/methods";
import { displayHandle, payLink, type HandleMethod } from "@/lib/cobros/handles";
import { TipPicker } from "./TipPicker";
import { CopyButton } from "@/components/CopyButton";
import { useLang, useT } from "@/components/i18n/LangProvider";

export interface PayApp {
  method: HandleMethod;
  handle: string;
  /** Zelle: the name the customer should see in their bank app. */
  name?: string;
}

interface Props {
  code: string;
  amount: number | string;
  currency: string;
  businessName: string;
  tipsAllowed: boolean;
  /** Apps the customer can pay the merchant's handle with (Zelle, Venmo, Cash App, PayPal). */
  apps: PayApp[];
  /** Card / Apple Pay / Google Pay through Stripe is offered on this charge. */
  card: boolean;
  /** Back from Stripe's page: wait for Stripe's confirmation. */
  returned: boolean;
}

/**
 * Real money. The customer needs no Avec account.
 * - Card / Apple Pay / Google Pay: Stripe's page; Stripe tells Avec when it's paid.
 * - Zelle, Venmo, Cash App, PayPal: they pay the merchant's handle from their
 *   own app, then tap "I paid"; the merchant confirms once it arrives.
 * Avec never touches the money.
 */
export function LivePayFlow({ code, amount, currency, businessName, tipsAllowed, apps, card, returned }: Props) {
  const t = useT();
  const info = methodInfo(useLang());
  const [tip, setTip] = useState<number | null>(0);
  const onTip = useCallback((v: number | null) => setTip(v), []);
  const [name, setName] = useState("");
  const [app, setApp] = useState<HandleMethod | null>(apps[0]?.method ?? null);
  const [stage, setStage] = useState<"pay" | "waiting" | "card_processing" | "confirmed">(returned ? "card_processing" : "pay");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const total = addMoney(amount, tip ?? 0);
  const totalText = formatMoney(total, currency);
  const plain = total.toFixed(2);
  const chosen = apps.find((a) => a.method === app) ?? null;

  // After reporting (or paying by card), wait for the confirmation.
  useEffect(() => {
    if (stage !== "waiting" && stage !== "card_processing") return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/cobros/public/${code}`, { cache: "no-store" });
      if (res.ok && (await res.json()).status === "paid") setStage("confirmed");
    }, 3000);
    return () => clearInterval(timer);
  }, [stage, code]);

  async function payByCard() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/cobros/live/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, tip: tip ?? 0 }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
      setBusy(false);
      return setError(data.error ?? t({ es: "No se pudo abrir el pago con tarjeta", en: "Couldn't open the card payment" }));
    }
    window.location.assign(data.url);
  }

  async function report() {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/cobros/live/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, tip: tip ?? 0, payerName: name, method: chosen.method }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? t({ es: "No se pudo reportar el pago", en: "Couldn't report the payment" }));
    setStage("waiting");
  }

  if (!apps.length && !card) return <p className="card text-slate-700">{t({ es: "Este negocio todavía no configuró cómo recibir pagos.", en: "This business hasn't set up how to receive payments yet." })}</p>;

  if (stage === "confirmed") {
    return (
      <div className="card space-y-3 border-emerald-300 bg-emerald-50 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-4xl text-white">✓</div>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">{t({ es: "Pago confirmado", en: "Payment confirmed" })}</p>
        {/* Back from Stripe the tip picked there isn't known here, so no amount. */}
        {!returned && <p className="text-3xl font-black">{totalText}</p>}
        <p className="text-slate-700">{t({ es: `${businessName} recibió tu pago. ¡Gracias!`, en: `${businessName} got your payment. Thank you!` })}</p>
      </div>
    );
  }

  if (stage === "card_processing") {
    return (
      <div className="card space-y-3 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-brand-ink" />
        <p className="font-semibold">{t({ es: "Confirmando tu pago…", en: "Confirming your payment…" })}</p>
        <p className="text-sm text-slate-600">{t({ es: "Esta pantalla cambia sola en unos segundos.", en: "This screen updates on its own in a few seconds." })}</p>
      </div>
    );
  }

  if (stage === "waiting") {
    const via = chosen ? info[chosen.method].label : "";
    return (
      <div className="card space-y-3 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-brand-ink" />
        <p className="font-semibold">{t({ es: `Esperando que ${businessName} confirme`, en: `Waiting for ${businessName} to confirm` })}</p>
        <p className="text-sm text-slate-600">
          {t({
            es: `Le avisamos que enviaste ${totalText} por ${via}. Esta pantalla cambia sola cuando lo confirme.`,
            en: `We let them know you sent ${totalText} by ${via}. This screen updates on its own once they confirm.`,
          })}
        </p>
      </div>
    );
  }

  const link = chosen ? payLink(chosen.method, chosen.handle, total, code) : null;

  return (
    <div className="space-y-4">
      {tipsAllowed && <TipPicker amount={amount} currency={currency} onChange={onTip} />}

      {card && (
        <div className="card space-y-3">
          <button type="button" className="btn-primary w-full py-4 text-base" disabled={busy || tip === null} onClick={payByCard}>
            {busy ? t({ es: "Abriendo…", en: "Opening…" }) : t({ es: `Pagar ${totalText} con tarjeta o Apple Pay`, en: `Pay ${totalText} with card or Apple Pay` })}
          </button>
          <p className="text-center text-xs text-slate-500">{t({ es: "Tarjeta, Apple Pay o Google Pay. Pago seguro con Stripe, sin cuenta en Avec.", en: "Card, Apple Pay or Google Pay. Secure with Stripe, no Avec account needed." })}</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      {apps.length > 0 && (
        <>
          {card && (
            <p className="text-center text-sm font-semibold text-slate-500">
              {apps.length === 1 && apps[0].method === "zelle"
                ? t({ es: "O paga por Zelle desde tu banco", en: "Or pay by Zelle from your bank" })
                : t({ es: "O paga desde tu app", en: "Or pay from your app" })}
            </p>
          )}
          {apps.length > 1 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="tablist">
              {apps.map((a) => (
                <button
                  key={a.method}
                  type="button"
                  role="tab"
                  aria-selected={a.method === app}
                  onClick={() => setApp(a.method)}
                  className={`rounded-xl border-2 px-3 py-3 text-sm font-semibold ${a.method === app ? "border-brand-ink bg-brand-yellow" : "border-slate-200 bg-white"}`}
                >
                  <span className="mr-1">{METHOD_ICON[a.method]}</span>
                  {info[a.method].label}
                </button>
              ))}
            </div>
          )}

          {chosen && (
            <div className="card space-y-3">
              {chosen.method === "zelle" ? (
                <>
                  <h2 className="font-semibold">{t({ es: "1. Envía el pago por Zelle", en: "1. Send the payment by Zelle" })}</h2>
                  <p className="text-sm text-slate-600">
                    {t({ es: "Abre la app de tu banco (Chase, Bank of America, Wells Fargo…) → Zelle → Enviar, con estos datos:", en: "Open your bank's app (Chase, Bank of America, Wells Fargo…) → Zelle → Send, with these details:" })}
                  </p>
                  <dl className="space-y-2">
                    <Row label={t({ es: "Para", en: "To" })} value={chosen.handle} copy={chosen.handle} />
                    <Row label={t({ es: "Nombre", en: "Name" })} value={chosen.name ?? businessName} />
                    <Row label={t({ es: "Monto", en: "Amount" })} value={totalText} copy={plain} strong />
                    <Row label={t({ es: "Nota / memo", en: "Note / memo" })} value={code} copy={code} />
                  </dl>
                  <p className="text-xs text-slate-500">
                    {t({ es: `Revisa que el nombre en Zelle diga “${chosen.name ?? businessName}” antes de enviar.`, en: `Check that the name in Zelle says “${chosen.name ?? businessName}” before sending.` })}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="font-semibold">{t({ es: `1. Paga con ${info[chosen.method].label}`, en: `1. Pay with ${info[chosen.method].label}` })}</h2>
                  <dl className="space-y-2">
                    <Row label={t({ es: "Para", en: "To" })} value={displayHandle(chosen.method, chosen.handle)} copy={displayHandle(chosen.method, chosen.handle)} />
                    <Row label={t({ es: "Monto", en: "Amount" })} value={totalText} copy={plain} strong />
                    <Row label={t({ es: "Nota", en: "Note" })} value={code} copy={code} />
                  </dl>
                  {link && (
                    <a className="btn-primary w-full py-4 text-base" href={link} target="_blank" rel="noreferrer">
                      {METHOD_ICON[chosen.method]} {t({ es: `Abrir ${info[chosen.method].label} con ${totalText}`, en: `Open ${info[chosen.method].label} with ${totalText}` })}
                    </a>
                  )}
                </>
              )}
            </div>
          )}

          {chosen && (
            <div className="card space-y-3">
              <h2 className="font-semibold">{t({ es: "2. Avísale al negocio", en: "2. Let the business know" })}</h2>
              <input className="input" placeholder={t({ es: "Tu nombre (opcional)", en: "Your name (optional)" })} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label={t({ es: "Tu nombre", en: "Your name" })} />
              {error && !card && <p className="text-sm text-red-600">{error}</p>}
              <button type="button" className={`${card ? "btn-secondary" : "btn-primary"} w-full py-4 text-base`} disabled={busy || tip === null} onClick={report}>
                {busy
                  ? t({ es: "Enviando…", en: "Sending…" })
                  : t({ es: `Ya pagué ${totalText} por ${info[chosen.method].label}`, en: `I paid ${totalText} by ${info[chosen.method].label}` })}
              </button>
              <p className="text-xs text-slate-500">{t({ es: "Toca este botón solo después de enviar el pago.", en: "Only tap this button after you send the payment." })}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Row({ label, value, copy, strong }: { label: string; value: string; copy?: string; strong?: boolean }) {
  const t = useT();
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
      <div className="min-w-0">
        <dt className="text-xs text-slate-500">{label}</dt>
        <dd className={`break-words ${strong ? "text-xl font-black" : "font-semibold"}`}>{value}</dd>
      </div>
      {copy && <CopyButton value={copy} label={t({ es: "Copiar", en: "Copy" })} />}
    </div>
  );
}
