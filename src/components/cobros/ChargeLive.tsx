"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { formatDateTime, formatMoney } from "@/lib/cobros/parse";
import { methodInfo, isMethod } from "@/lib/cobros/methods";
import { addMoney } from "@/lib/cobros/tip";
import { useLang, useT } from "@/components/i18n/LangProvider";

export interface ChargeView {
  id: string;
  code: string;
  status: "pending" | "reported" | "paid" | "cancelled";
  mode?: string;
  kind?: "quick" | "ticket" | "link";
  ticket_ref?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  tip_only?: boolean;
  reported_at?: string | null;
  amount: number | string;
  tip_amount?: number | string | null;
  currency: string;
  description?: string | null;
  paid_method: string | null;
  paid_reference: string | null;
  payer_name: string | null;
  paid_at: string | null;
  expires_at: string;
}

/**
 * The merchant's screen while a customer pays: the QR, then the confirmation.
 * The app never receives the money; it shows that the bank (Banco Demo here)
 * confirmed the transfer into the merchant's account.
 */
export function ChargeLive({ initial, businessName }: { initial: ChargeView; businessName: string }) {
  const t = useT();
  const lang = useLang();
  const [charge, setCharge] = useState(initial);
  const [qr, setQr] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const expired = charge.status === "pending" && new Date(charge.expires_at).getTime() < now;
  const waiting = (charge.status === "pending" && !expired) || charge.status === "reported";
  const live = charge.mode === "live";
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const url = `${window.location.origin}/pagar/${charge.code}`;
    setLink(url);
    QRCode.toDataURL(url, { width: 640, margin: 2, color: { dark: "#1B1E25", light: "#FFFFFF" } }).then(setQr);
  }, [charge.code]);

  // Poll for the bank's confirmation while waiting.
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(async () => {
      setNow(Date.now());
      const res = await fetch(`/api/cobros/charges/${charge.id}`, { cache: "no-store" });
      if (res.ok) {
        const next = (await res.json()) as ChargeView;
        setCharge((c) => ({ ...c, ...next }));
        if (next.status === "paid" && "vibrate" in navigator) navigator.vibrate?.([80, 40, 80]);
      }
    }, 2000);
    return () => clearInterval(t);
  }, [waiting, charge.id]);

  async function confirm(received: boolean) {
    setConfirming(true);
    const res = await fetch(`/api/cobros/charges/${charge.id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ received }),
    });
    setConfirming(false);
    if (res.ok) {
      const next = await fetch(`/api/cobros/charges/${charge.id}`, { cache: "no-store" });
      const fresh = next.ok ? ((await next.json()) as ChargeView) : null;
      if (fresh) setCharge((c) => ({ ...c, ...fresh }));
    }
  }

  async function cancel() {
    setCancelling(true);
    const res = await fetch(`/api/cobros/charges/${charge.id}/cancel`, { method: "POST" });
    setCancelling(false);
    if (res.ok) setCharge((c) => ({ ...c, status: "cancelled" }));
  }

  if (charge.status === "paid") {
    return (
      <div className="space-y-4">
        <div className="card space-y-3 border-emerald-300 bg-emerald-50 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-5xl text-white">✓</div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">{t({ es: "Pago confirmado", en: "Payment confirmed" })}</p>
          <p className="text-4xl font-black">{formatMoney(addMoney(charge.amount, charge.tip_amount ?? 0), charge.currency)}</p>
          {Number(charge.tip_amount) > 0 && (
            <p className="text-sm text-slate-700">
              {formatMoney(charge.amount, charge.currency)} + {t({ es: "propina", en: "tip" })} <b>{formatMoney(charge.tip_amount!, charge.currency)}</b> 🎉
            </p>
          )}
          <p className="text-slate-700">
            {t({ es: "de", en: "from" })} <b>{charge.payer_name ?? t({ es: "Cliente", en: "Customer" })}</b>
            {isMethod(charge.paid_method) && <> · {methodInfo(lang)[charge.paid_method].label}</>}
          </p>
          <p className="text-sm text-slate-600">
            {charge.paid_reference && (
              <>
                {t({ es: "Referencia", en: "Reference" })} <span className="font-mono font-semibold">{charge.paid_reference}</span>
                {charge.paid_at && " · "}
              </>
            )}
            {charge.paid_at && formatDateTime(charge.paid_at, lang)}
          </p>
          <p className="text-xs text-slate-500">
            {!live
              ? t({ es: "El dinero está en tu cuenta de Banco Demo, no en Avec.", en: "The money is in your Demo Bank account, not in Avec." })
              : charge.paid_method === "card"
                ? t({
                    es: "Cobrado por Stripe. Llega a tu banco con el próximo depósito de Stripe. Avec no toca el dinero.",
                    en: "Charged through Stripe. It reaches your bank with Stripe’s next payout. Avec never touches the money.",
                  })
                : t({ es: "Confirmado por tu equipo al verlo llegar. Avec no toca el dinero.", en: "Confirmed by your team when it arrived. Avec never touches the money." })}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/cobrar" className="btn-primary">{t({ es: "Nuevo cobro", en: "New charge" })}</Link>
          {live ? (
            <Link href="/cobrar/historial" className="btn-secondary">{t({ es: "Historial", en: "History" })}</Link>
          ) : (
            <Link href="/banco-demo" className="btn-secondary">{t({ es: "Ver Banco Demo", en: "View Demo Bank" })}</Link>
          )}
        </div>
      </div>
    );
  }

  if (charge.status === "reported") {
    return (
      <div className="space-y-4">
        <div className="card space-y-3 border-amber-300 bg-amber-50 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-800">{t({ es: "El cliente dice que ya pagó", en: "Customer says they paid" })}</p>
          <p className="text-4xl font-black">{formatMoney(addMoney(charge.amount, charge.tip_amount ?? 0), charge.currency)}</p>
          {Number(charge.tip_amount) > 0 && (
            <p className="text-sm text-slate-700">
              {formatMoney(charge.amount, charge.currency)} + {t({ es: "propina", en: "tip" })} {formatMoney(charge.tip_amount!, charge.currency)}
            </p>
          )}
          <p className="text-slate-700">
            {isMethod(charge.paid_method) && <>{t({ es: "por", en: "via" })} {methodInfo(lang)[charge.paid_method].label} · </>}
            {t({ es: "de", en: "from" })} <b>{charge.payer_name ?? t({ es: "Cliente", en: "Customer" })}</b> · {t({ es: "nota", en: "note" })} <span className="font-mono">{charge.code}</span>
          </p>
          <p className="text-sm text-slate-600">{t({ es: "Abre tu banco o la app de pago y confirma que llegó antes de entregar.", en: "Open your bank or payment app and confirm it arrived before handing anything over." })}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" className="btn-primary" disabled={confirming} onClick={() => confirm(true)}>✓ {t({ es: "Recibido", en: "Received" })}</button>
          <button type="button" className="btn-secondary" disabled={confirming} onClick={() => confirm(false)}>{t({ es: "No llegó", en: "Didn’t arrive" })}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3 text-center">
        <p className="text-sm font-medium text-slate-500">{businessName}</p>
        {charge.ticket_ref && (
          <p className="text-sm font-semibold text-slate-700">
            {t({ es: "Ticket", en: "Ticket" })} #{charge.ticket_ref}
            {charge.customer_name && <> · {charge.customer_name}</>}
          </p>
        )}
        {charge.tip_only && <p className="text-sm font-semibold text-emerald-700">{t({ es: "Propina", en: "Tip" })}</p>}
        <p className="text-4xl font-black">{formatMoney(charge.amount, charge.currency)}</p>
        {charge.description && <p className="text-sm text-slate-600">{charge.description}</p>}
        <div className={`mx-auto w-full max-w-xs ${waiting ? "" : "opacity-30"}`}>
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={t({ es: `QR para pagar ${formatMoney(charge.amount, charge.currency)}`, en: `QR to pay ${formatMoney(charge.amount, charge.currency)}` })} className="w-full rounded-xl" />
          ) : (
            <div className="aspect-square w-full animate-pulse rounded-xl bg-slate-100" />
          )}
        </div>
        {waiting && (
          <p className="flex items-center justify-center gap-2 text-sm text-slate-600">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-500" /> {t({ es: "Esperando el pago…", en: "Waiting for payment…" })}
          </p>
        )}
        {expired && <p className="font-semibold text-slate-700">{t({ es: "Este cobro venció.", en: "This charge expired." })}</p>}
        {charge.status === "cancelled" && <p className="font-semibold text-slate-700">{t({ es: "Cobro cancelado.", en: "Charge cancelled." })}</p>}
        <p className="font-mono text-xs tracking-widest text-slate-400">{charge.code}</p>
      </div>

      {waiting ? (
        <div className="grid grid-cols-2 gap-3">
          <a className="btn-primary" href={`https://wa.me/?text=${encodeURIComponent(t({ es: `Paga ${formatMoney(charge.amount, charge.currency)} a ${businessName}: ${link}`, en: `Pay ${formatMoney(charge.amount, charge.currency)} to ${businessName}: ${link}` }))}`}>
            WhatsApp
          </a>
          <button
            type="button"
            className="btn-secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? t({ es: "Copiado", en: "Copied" }) : t({ es: "Copiar enlace", en: "Copy link" })}
          </button>
          {live && (
            <button type="button" className="col-span-2 text-sm text-brand-ink underline" onClick={() => confirm(true)} disabled={confirming}>
              {t({ es: "Ya lo recibí en mi banco o app: marcar como pagado", en: "I received it in my bank or app: mark as paid" })}
            </button>
          )}
          {charge.customer_email && <EmailLink id={charge.id} email={charge.customer_email} />}
          <button type="button" className="col-span-2 text-sm text-slate-500 underline" onClick={cancel} disabled={cancelling}>
            {t({ es: "Cancelar cobro", en: "Cancel charge" })}
          </button>
        </div>
      ) : (
        <Link href="/cobrar" className="btn-primary w-full">{t({ es: "Nuevo cobro", en: "New charge" })}</Link>
      )}
    </div>
  );
}

/** Tickets: email the customer the pay link (Business plan; the API says if not). */
function EmailLink({ id, email }: { id: string; email: string }) {
  const t = useT();
  const [state, setState] = useState<"idle" | "busy" | "sent" | string>("idle");
  return (
    <button
      type="button"
      className="col-span-2 text-sm text-brand-ink underline disabled:no-underline disabled:opacity-60"
      disabled={state === "busy" || state === "sent"}
      onClick={async () => {
        setState("busy");
        const res = await fetch(`/api/cobros/charges/${id}/remind`, { method: "POST" });
        setState(res.ok ? "sent" : ((await res.json().catch(() => ({}))).error ?? "Error"));
      }}
    >
      {state === "sent"
        ? t({ es: `Enlace enviado a ${email} ✓`, en: `Link sent to ${email} ✓` })
        : state === "busy"
          ? "…"
          : state !== "idle"
            ? state
            : t({ es: `Enviar el enlace de pago a ${email}`, en: `Email the pay link to ${email}` })}
    </button>
  );
}
