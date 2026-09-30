"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n/LangProvider";

const VALID_DAYS = [1, 7, 30] as const;

/**
 * New charge: a quick sale (QR valid 30 minutes), or on Team and Business a
 * ticket / invoice that stays open for days and is found by its number.
 */
export function ChargeForm({ currencySymbol, tickets = false }: { currencySymbol: string; tickets?: boolean }) {
  const router = useRouter();
  const t = useT();
  const [kind, setKind] = useState<"quick" | "ticket">("quick");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [ticketRef, setTicketRef] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [days, setDays] = useState<(typeof VALID_DAYS)[number]>(7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/cobros/charges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        kind === "ticket"
          ? { amount, description, kind, ticketRef, customerName, customerEmail, validDays: days }
          : { amount, description, kind },
      ),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      return setError(body.error === "Invalid input" ? t({ es: "Revisa el monto y los datos", en: "Check the amount and details" }) : (body.error ?? t({ es: "No se pudo crear el cobro", en: "Couldn’t create the charge" })));
    }
    router.push(`/cobrar/${body.id}`);
  }

  const valid = Number(amount) > 0 && (kind === "quick" || ticketRef.trim().length > 0);
  const tab = (active: boolean) => `flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${active ? "bg-brand-ink text-white" : "text-slate-600"}`;
  return (
    <form onSubmit={create} className="card space-y-4">
      {tickets && (
        <div className="flex gap-1 rounded-2xl bg-slate-100 p-1" role="tablist">
          <button type="button" role="tab" aria-selected={kind === "quick"} className={tab(kind === "quick")} onClick={() => setKind("quick")}>
            {t({ es: "Venta rápida", en: "Quick sale" })}
          </button>
          <button type="button" role="tab" aria-selected={kind === "ticket"} className={tab(kind === "ticket")} onClick={() => setKind("ticket")}>
            {t({ es: "Ticket / factura", en: "Ticket / invoice" })}
          </button>
        </div>
      )}

      {kind === "ticket" && (
        <div className="grid gap-3">
          <input className="input" placeholder={t({ es: "Número de ticket o factura *", en: "Ticket or invoice number *" })} maxLength={40} value={ticketRef} onChange={(e) => setTicketRef(e.target.value)} aria-label={t({ es: "Número de ticket", en: "Ticket number" })} />
          <input className="input" placeholder={t({ es: "Nombre del cliente", en: "Customer name" })} maxLength={80} value={customerName} onChange={(e) => setCustomerName(e.target.value)} aria-label={t({ es: "Nombre del cliente", en: "Customer name" })} />
          <input className="input" type="email" inputMode="email" placeholder={t({ es: "Correo del cliente (para recordatorios)", en: "Customer email (for reminders)" })} maxLength={200} value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} aria-label={t({ es: "Correo del cliente", en: "Customer email" })} />
        </div>
      )}

      <label className="label" htmlFor="amt">{t({ es: "¿Cuánto vas a cobrar?", en: "How much are you charging?" })}</label>
      <div className="flex items-center gap-2 rounded-2xl border-2 border-slate-200 px-4 focus-within:border-brand-ink">
        <span className="text-3xl font-bold text-slate-400">{currencySymbol}</span>
        <input
          id="amt"
          inputMode="decimal"
          autoFocus
          className="w-full bg-transparent py-4 text-4xl font-bold outline-none"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
        />
      </div>
      <input className="input" placeholder={kind === "ticket" ? t({ es: "Trabajo realizado (opcional)", en: "Work done (optional)" }) : t({ es: "Descripción (opcional)", en: "Description (optional)" })} maxLength={140} value={description} onChange={(e) => setDescription(e.target.value)} />

      {kind === "ticket" && (
        <div>
          <p className="label">{t({ es: "El QR queda abierto por", en: "QR stays open for" })}</p>
          <div className="flex gap-2">
            {VALID_DAYS.map((d) => (
              <button key={d} type="button" onClick={() => setDays(d)} className={`flex-1 rounded-xl border-2 py-2 text-sm font-semibold ${days === d ? "border-brand-ink bg-brand-yellow" : "border-slate-200"}`}>
                {d === 1 ? t({ es: "1 día", en: "1 day" }) : t({ es: `${d} días`, en: `${d} days` })}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-full py-4 text-base" disabled={!valid || busy}>
        {busy ? t({ es: "Generando…", en: "Generating…" }) : t({ es: "Generar QR", en: "Generate QR" })}
      </button>
    </form>
  );
}
