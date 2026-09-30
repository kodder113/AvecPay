"use client";
import { useEffect, useState } from "react";
import { countryName } from "@/lib/format";
import { useLang, useT } from "@/components/i18n/LangProvider";

interface Recipient {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  country_code: string;
}

export function RecipientManager({ initial }: { initial: Recipient[] }) {
  const t = useT();
  const lang = useLang();
  const [items, setItems] = useState(initial);
  const [countries, setCountries] = useState<{ code: string; name: string }[]>([]);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", countryCode: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/countries").then(async (r) => r.ok && setCountries(await r.json()));
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/recipients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) return setError(body.details?.[0]?.message ?? body.error);
    setItems([body, ...items]);
    setForm({ fullName: "", email: "", phone: "", countryCode: "" });
  }

  async function remove(id: string) {
    const res = await fetch(`/api/recipients/${id}`, { method: "DELETE" });
    if (res.ok) setItems(items.filter((i) => i.id !== id));
    else setError((await res.json()).error);
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {items.map((r) => (
          <li key={r.id} className="card flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">{r.full_name}</p>
              <p className="truncate text-sm text-slate-600">{[r.email, r.phone].filter(Boolean).join(" · ")}</p>
              <p className="text-xs text-slate-500">{countryName(r.country_code, lang)}</p>
            </div>
            <button className="text-sm text-red-600" onClick={() => remove(r.id)}>
              {t({ es: "Eliminar", en: "Delete" })}
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="card space-y-3">
        <h2 className="font-semibold">{t({ es: "Agregar destinatario", en: "Add recipient" })}</h2>
        <input className="input" placeholder={t({ es: "Nombre completo", en: "Full name" })} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        <input className="input" type="email" placeholder={t({ es: "Correo", en: "Email" })} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="input" type="tel" placeholder={t({ es: "Teléfono (+504 …)", en: "Phone (+504 …)" })} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <select className="input" value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value })}>
          <option value="">{t({ es: "País…", en: "Country…" })}</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {t({ es: "Guardar destinatario", en: "Save recipient" })}
        </button>
      </form>
    </div>
  );
}
