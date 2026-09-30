"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PLAN_IDS, PLANS } from "@/lib/business/plans";
import { useT } from "@/components/i18n/LangProvider";

async function send(method: string, path: string, body: unknown): Promise<string | null> {
  const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.ok) return null;
  return ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Error";
}

/** Create activation (paid in person), trial or discount codes. */
export function AdminPromoForm() {
  const t = useT();
  const router = useRouter();
  const [v, setV] = useState({ code: "", kind: "activation", plan: "team", months: "1", days: "30", percentOff: "20", maxUses: "1", expiresAt: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: keyof typeof v, val: string) => setV((s) => ({ ...s, [k]: val }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const err = await send("POST", "/api/admin/promo", {
      code: v.code,
      kind: v.kind,
      plan: v.plan,
      months: v.kind === "activation" || v.kind === "discount" ? Number(v.months) || undefined : undefined,
      days: v.kind === "trial" ? Number(v.days) : undefined,
      percentOff: v.kind === "discount" ? Number(v.percentOff) : undefined,
      maxUses: v.maxUses ? Number(v.maxUses) : undefined,
      expiresAt: v.expiresAt || undefined,
      note: v.note || undefined,
    });
    setBusy(false);
    if (err) return setMsg(err);
    setMsg(t({ es: `Código ${v.code.toUpperCase()} creado.`, en: `Code ${v.code.toUpperCase()} created.` }));
    setV((s) => ({ ...s, code: "", note: "" }));
    router.refresh();
  }

  function randomCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    set("code", `AVEC-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`);
  }

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
      <div className="flex gap-2 md:col-span-2">
        <input className="input uppercase" placeholder="MSA2026" value={v.code} onChange={(e) => set("code", e.target.value)} aria-label="Code" required />
        <button type="button" className="btn-secondary shrink-0" onClick={randomCode}>
          {t({ es: "Generar", en: "Generate" })}
        </button>
      </div>
      <select className="input" value={v.kind} onChange={(e) => set("kind", e.target.value)} aria-label={t({ es: "Tipo", en: "Type" })}>
        <option value="activation">{t({ es: "Activación (pagado en persona)", en: "Activation (paid in person)" })}</option>
        <option value="trial">{t({ es: "Prueba gratis", en: "Free trial" })}</option>
        <option value="discount">{t({ es: "Descuento", en: "Discount" })}</option>
      </select>
      {v.kind !== "discount" && (
        <select className="input" value={v.plan} onChange={(e) => set("plan", e.target.value)} aria-label="Plan">
          {PLAN_IDS.map((p) => (
            <option key={p} value={p}>
              {PLANS[p].name}
            </option>
          ))}
        </select>
      )}
      {v.kind === "activation" && (
        <label className="text-sm">
          {t({ es: "Meses", en: "Months" })}
          <input className="input" type="number" min={1} max={36} value={v.months} onChange={(e) => set("months", e.target.value)} />
        </label>
      )}
      {v.kind === "trial" && (
        <label className="text-sm">
          {t({ es: "Días gratis", en: "Free days" })}
          <input className="input" type="number" min={1} max={365} value={v.days} onChange={(e) => set("days", e.target.value)} />
        </label>
      )}
      {v.kind === "discount" && (
        <>
          <label className="text-sm">
            {t({ es: "% de descuento", en: "% off" })}
            <input className="input" type="number" min={1} max={100} value={v.percentOff} onChange={(e) => set("percentOff", e.target.value)} />
          </label>
          <label className="text-sm">
            {t({ es: "Por cuántos meses (vacío = siempre)", en: "For how many months (empty = forever)" })}
            <input className="input" type="number" min={1} max={36} value={v.months} onChange={(e) => set("months", e.target.value)} />
          </label>
        </>
      )}
      <label className="text-sm">
        {t({ es: "Máximo de usos (vacío = sin límite)", en: "Max uses (empty = unlimited)" })}
        <input className="input" type="number" min={1} value={v.maxUses} onChange={(e) => set("maxUses", e.target.value)} />
      </label>
      <label className="text-sm">
        {t({ es: "Vence (opcional)", en: "Expires (optional)" })}
        <input className="input" type="date" value={v.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} />
      </label>
      <input className="input md:col-span-2" placeholder={t({ es: "Nota (ej. pagó $49 en efectivo, Juan's HVAC)", en: "Note (e.g. paid $49 cash, Juan's HVAC)" })} value={v.note} onChange={(e) => set("note", e.target.value)} maxLength={200} />
      {msg && <p className="text-sm md:col-span-2">{msg}</p>}
      <button className="btn-primary md:col-span-2" disabled={busy || !v.code.trim()}>
        {busy ? "…" : t({ es: "Crear código", en: "Create code" })}
      </button>
    </form>
  );
}

export function AdminPromoToggle({ code, active }: { code: string; active: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={`text-xs font-semibold underline ${active ? "text-red-600" : "text-emerald-700"}`}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await send("PATCH", "/api/admin/promo", { code, active: !active });
        setBusy(false);
        router.refresh();
      }}
    >
      {active ? "Disable" : "Enable"}
    </button>
  );
}

export function AdminLaunchForm({ on, until }: { on: boolean; until: string | null }) {
  const t = useT();
  const router = useRouter();
  const [date, setDate] = useState(until?.slice(0, 10) ?? "");
  const [busy, setBusy] = useState(false);
  async function save(nextOn: boolean) {
    setBusy(true);
    await send("POST", "/api/admin/settings", { on: nextOn, until: nextOn && date ? date : null });
    setBusy(false);
    router.refresh();
  }
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-sm">
        {t({ es: "Hasta (opcional)", en: "Until (optional)" })}
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <button type="button" className="btn-primary" disabled={busy} onClick={() => save(true)}>
        {on ? t({ es: "Guardar fecha", en: "Save date" }) : t({ es: "Activar", en: "Turn on" })}
      </button>
      {on && (
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => save(false)}>
          {t({ es: "Apagar", en: "Turn off" })}
        </button>
      )}
    </div>
  );
}
