"use client";
import { useCallback, useEffect, useState } from "react";
import { formatMoney } from "@/lib/cobros/parse";
import { addMoney } from "@/lib/cobros/tip";
import { TipPicker } from "./TipPicker";
import { CopyButton } from "@/components/CopyButton";
import { useT } from "@/components/i18n/LangProvider";

interface Props {
  code: string;
  amount: number | string;
  currency: string;
  businessName: string;
  tipsAllowed: boolean;
  zelle: { handle: string; name: string } | null;
  /** Card / Apple Pay through Stripe is offered on this charge. */
  card: boolean;
  /** Back from Stripe's page: wait for Stripe's confirmation. */
  returned: boolean;
}

/**
 * Real money. The customer needs no Avec account.
 * - Card / Apple Pay: Stripe's page; Stripe tells Avec when it's paid.
 * - Zelle: they send the total from their own bank app, then tap "Ya pagué";
 *   the merchant confirms once it shows up in their bank.
 * Avec never touches the money.
 */
export function LivePayFlow({ code, amount, currency, businessName, tipsAllowed, zelle, card, returned }: Props) {
  const t = useT();
  const [tip, setTip] = useState<number | null>(0);
  const onTip = useCallback((v: number | null) => setTip(v), []);
  const [name, setName] = useState("");
  const [stage, setStage] = useState<"pay" | "waiting" | "card_processing" | "confirmed">(returned ? "card_processing" : "pay");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const total = addMoney(amount, tip ?? 0);
  const totalText = formatMoney(total, currency);
  const plain = total.toFixed(2);

  // After reporting, wait for the merchant's confirmation.
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
    setBusy(true);
    setError(null);
    const res = await fetch("/api/cobros/live/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, tip: tip ?? 0, payerName: name }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? t({ es: "No se pudo reportar el pago", en: "Couldn't report the payment" }));
    setStage("waiting");
  }

  if (!zelle && !card) return <p className="card text-slate-700">{t({ es: "Este comercio todavía no configuró cómo recibir pagos.", en: "This merchant hasn't set up how to receive payments yet." })}</p>;

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
    return (
      <div className="card space-y-3 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-brand-ink" />
        <p className="font-semibold">{t({ es: `Esperando que ${businessName} confirme`, en: `Waiting for ${businessName} to confirm` })}</p>
        <p className="text-sm text-slate-600">
          {t({
            es: `Le avisamos que enviaste ${totalText} por Zelle. Esta pantalla cambia sola cuando lo confirme.`,
            en: `We let them know you sent ${totalText} by Zelle. This screen updates on its own once they confirm.`,
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tipsAllowed && <TipPicker amount={amount} currency={currency} onChange={onTip} />}

      {card && (
        <div className="card space-y-3">
          <button type="button" className="btn-primary w-full py-4 text-base" disabled={busy || tip === null} onClick={payByCard}>
            {busy ? t({ es: "Abriendo…", en: "Opening…" }) : t({ es: `Pagar ${totalText} con tarjeta o Apple Pay`, en: `Pay ${totalText} with card or Apple Pay` })}
          </button>
          <p className="text-center text-xs text-slate-500">{t({ es: "Pago seguro con Stripe. No necesitas cuenta en Avec.", en: "Secure payment with Stripe. No Avec account needed." })}</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      {zelle && (
        <>
          {card && <p className="text-center text-sm font-semibold text-slate-500">{t({ es: "O paga por Zelle desde tu banco", en: "Or pay by Zelle from your bank" })}</p>}
          <div className="card space-y-3">
            <h2 className="font-semibold">{t({ es: "1. Envía el pago por Zelle", en: "1. Send the payment by Zelle" })}</h2>
            <p className="text-sm text-slate-600">{t({ es: "Abre la app de tu banco (Chase, Bank of America, Wells Fargo…) → Zelle → Enviar, con estos datos:", en: "Open your bank's app (Chase, Bank of America, Wells Fargo…) → Zelle → Send, with these details:" })}</p>
            <dl className="space-y-2">
              <Row label={t({ es: "Para", en: "To" })} value={zelle.handle} copy={zelle.handle} />
              <Row label={t({ es: "Nombre", en: "Name" })} value={zelle.name} />
              <Row label={t({ es: "Monto", en: "Amount" })} value={totalText} copy={plain} strong />
              <Row label={t({ es: "Nota / memo", en: "Note / memo" })} value={code} copy={code} />
            </dl>
            <p className="text-xs text-slate-500">{t({ es: `Revisa que el nombre en Zelle diga “${zelle.name}” antes de enviar.`, en: `Check that the name in Zelle says “${zelle.name}” before sending.` })}</p>
          </div>

          <div className="card space-y-3">
            <h2 className="font-semibold">{t({ es: "2. Avísale al comercio", en: "2. Let the merchant know" })}</h2>
            <input className="input" placeholder={t({ es: "Tu nombre (opcional)", en: "Your name (optional)" })} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label={t({ es: "Tu nombre", en: "Your name" })} />
            {error && !card && <p className="text-sm text-red-600">{error}</p>}
            <button type="button" className={`${card ? "btn-secondary" : "btn-primary"} w-full py-4 text-base`} disabled={busy || tip === null} onClick={report}>
              {busy ? t({ es: "Enviando…", en: "Sending…" }) : t({ es: `Ya pagué ${totalText} por Zelle`, en: `I paid ${totalText} by Zelle` })}
            </button>
            <p className="text-xs text-slate-500">{t({ es: "Toca este botón solo después de enviar el Zelle.", en: "Only tap this button after you send the Zelle." })}</p>
          </div>
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
