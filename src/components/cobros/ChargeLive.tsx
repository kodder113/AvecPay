"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { formatDateTime, formatMoney } from "@/lib/cobros/parse";
import { METHOD_INFO, isMethod } from "@/lib/cobros/methods";
import { addMoney } from "@/lib/cobros/tip";

export interface ChargeView {
  id: string;
  code: string;
  status: "pending" | "paid" | "cancelled";
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
  const [charge, setCharge] = useState(initial);
  const [qr, setQr] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const expired = charge.status === "pending" && new Date(charge.expires_at).getTime() < now;
  const waiting = charge.status === "pending" && !expired;

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
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Pago confirmado</p>
          <p className="text-4xl font-black">{formatMoney(addMoney(charge.amount, charge.tip_amount ?? 0), charge.currency)}</p>
          {Number(charge.tip_amount) > 0 && (
            <p className="text-sm text-slate-700">
              {formatMoney(charge.amount, charge.currency)} + propina <b>{formatMoney(charge.tip_amount!, charge.currency)}</b> 🎉
            </p>
          )}
          <p className="text-slate-700">
            de <b>{charge.payer_name ?? "Cliente"}</b>
            {isMethod(charge.paid_method) && <> · {METHOD_INFO[charge.paid_method].label}</>}
          </p>
          <p className="text-sm text-slate-600">
            Referencia <span className="font-mono font-semibold">{charge.paid_reference}</span>
            {charge.paid_at && <> · {formatDateTime(charge.paid_at)}</>}
          </p>
          <p className="text-xs text-slate-500">El dinero está en tu cuenta de Banco Demo, no en Avec.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/cobrar" className="btn-primary">Nuevo cobro</Link>
          <Link href="/banco-demo" className="btn-secondary">Ver Banco Demo</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3 text-center">
        <p className="text-sm font-medium text-slate-500">{businessName}</p>
        <p className="text-4xl font-black">{formatMoney(charge.amount, charge.currency)}</p>
        {charge.description && <p className="text-sm text-slate-600">{charge.description}</p>}
        <div className={`mx-auto w-full max-w-xs ${waiting ? "" : "opacity-30"}`}>
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={`QR para pagar ${formatMoney(charge.amount, charge.currency)}`} className="w-full rounded-xl" />
          ) : (
            <div className="aspect-square w-full animate-pulse rounded-xl bg-slate-100" />
          )}
        </div>
        {waiting && (
          <p className="flex items-center justify-center gap-2 text-sm text-slate-600">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-500" /> Esperando el pago…
          </p>
        )}
        {expired && <p className="font-semibold text-slate-700">Este cobro venció.</p>}
        {charge.status === "cancelled" && <p className="font-semibold text-slate-700">Cobro cancelado.</p>}
        <p className="font-mono text-xs tracking-widest text-slate-400">{charge.code}</p>
      </div>

      {waiting ? (
        <div className="grid grid-cols-2 gap-3">
          <a className="btn-primary" href={`https://wa.me/?text=${encodeURIComponent(`Paga ${formatMoney(charge.amount, charge.currency)} a ${businessName}: ${link}`)}`}>
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
            {copied ? "Copiado" : "Copiar enlace"}
          </button>
          <button type="button" className="col-span-2 text-sm text-slate-500 underline" onClick={cancel} disabled={cancelling}>
            Cancelar cobro
          </button>
        </div>
      ) : (
        <Link href="/cobrar" className="btn-primary w-full">Nuevo cobro</Link>
      )}
    </div>
  );
}
