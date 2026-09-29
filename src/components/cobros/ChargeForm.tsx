"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ChargeForm({ currencySymbol }: { currencySymbol: string }) {
  const router = useRouter();
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
      return setError(body.error === "Invalid input" ? "Monto inválido" : (body.error ?? "No se pudo crear el cobro"));
    }
    router.push(`/cobrar/${body.id}`);
  }

  const valid = Number(amount) > 0;
  return (
    <form onSubmit={create} className="card space-y-4">
      <label className="label" htmlFor="amt">¿Cuánto vas a cobrar?</label>
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
      <input className="input" placeholder="Descripción (opcional): 2 baleadas y un refresco" maxLength={140} value={description} onChange={(e) => setDescription(e.target.value)} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-full py-4 text-base" disabled={!valid || busy}>
        {busy ? "Generando…" : "Generar QR"}
      </button>
    </form>
  );
}
