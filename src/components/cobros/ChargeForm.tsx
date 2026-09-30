"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n/LangProvider";

export function ChargeForm({ currencySymbol }: { currencySymbol: string }) {
  const router = useRouter();
  const t = useT();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/cobros/charges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, description }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      return setError(body.error === "Invalid input" ? t({ es: "Monto inválido", en: "Invalid amount" }) : (body.error ?? t({ es: "No se pudo crear el cobro", en: "Couldn’t create the charge" })));
    }
    router.push(`/cobrar/${body.id}`);
  }

  const valid = Number(amount) > 0;
  return (
    <form onSubmit={create} className="card space-y-4">
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
      <input className="input" placeholder={t({ es: "Descripción (opcional): 2 baleadas y un refresco", en: "Description (optional): 2 baleadas and a soda" })} maxLength={140} value={description} onChange={(e) => setDescription(e.target.value)} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-full py-4 text-base" disabled={!valid || busy}>
        {busy ? t({ es: "Generando…", en: "Generating…" }) : t({ es: "Generar QR", en: "Generate QR" })}
      </button>
    </form>
  );
}
