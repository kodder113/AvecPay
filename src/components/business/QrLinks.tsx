"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useT } from "@/components/i18n/LangProvider";

export interface LinkView {
  id: string;
  code: string;
  kind: "pay" | "tip";
  label: string | null;
  member: string | null;
  active: boolean;
}

export function qrUrl(code: string): string {
  return `${window.location.origin}/q/${code}`;
}

export function QrImage({ code, size = 480, className }: { code: string; size?: number; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(qrUrl(code), { width: size, margin: 1, color: { dark: "#1B1E25", light: "#FFFFFF" } }).then(setSrc);
  }, [code, size]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={`QR ${code}`} className={className} /> : <div className={`aspect-square animate-pulse bg-slate-100 ${className ?? ""}`} />;
}

/** List of permanent QRs with create / print / turn off. */
export function QrLinks({ links, canManage, members, starter }: { links: LinkView[]; canManage: boolean; members: { id: string; name: string }[]; starter: boolean }) {
  const t = useT();
  const router = useRouter();
  const [kind, setKind] = useState<"pay" | "tip">("pay");
  const [label, setLabel] = useState("");
  const [member, setMember] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/cobros/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, label: label || undefined, memberUserId: member || undefined }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? t({ es: "No se pudo crear", en: "Couldn't create it" }));
    setLabel("");
    router.refresh();
  }

  async function toggle(id: string, active: boolean) {
    await fetch(`/api/cobros/links/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active }) });
    router.refresh();
  }

  const segment = (on: boolean) => `flex-1 rounded-xl border-2 px-3 py-2 text-sm font-semibold ${on ? "border-brand-ink bg-brand-yellow" : "border-slate-200"}`;

  return (
    <div className="space-y-4">
      {canManage && (
        <form onSubmit={create} className="card space-y-3">
          <h2 className="font-semibold">{t({ es: "Nuevo QR permanente", en: "New permanent QR" })}</h2>
          <div className="flex gap-2">
            <button type="button" className={segment(kind === "pay")} onClick={() => setKind("pay")}>
              💳 {t({ es: "Pagar cualquier monto", en: "Pay any amount" })}
            </button>
            <button type="button" className={segment(kind === "tip")} onClick={() => setKind("tip")}>
              💛 {t({ es: "Propinas", en: "Tips" })}
            </button>
          </div>
          <input className="input" placeholder={t({ es: "Nombre (ej. Mostrador, Camioneta 2)", en: "Name (e.g. Front desk, Truck 2)" })} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} aria-label={t({ es: "Nombre del QR", en: "QR name" })} />
          {members.length > 0 && (
            <select className="input" value={member} onChange={(e) => setMember(e.target.value)} aria-label={t({ es: "Para quién", en: "For whom" })}>
              <option value="">{t({ es: "Del negocio", en: "For the business" })}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {t({ es: `De ${m.name}`, en: `For ${m.name}` })}
                </option>
              ))}
            </select>
          )}
          {starter && <p className="text-xs text-slate-500">{t({ es: "Starter: un QR de pago y uno de propinas. Team y Business: uno por técnico.", en: "Starter: one pay QR and one tip QR. Team and Business: one per tech." })}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? t({ es: "Creando…", en: "Creating…" }) : t({ es: "Crear QR", en: "Create QR" })}
          </button>
        </form>
      )}

      {!links.length && <p className="card text-slate-600">{t({ es: "Todavía no tienes QR permanentes.", en: "No permanent QRs yet." })}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {links.map((l) => (
          <div key={l.id} className={`card space-y-3 ${l.active ? "" : "opacity-50"}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{l.label ?? (l.kind === "tip" ? t({ es: "Propinas", en: "Tips" }) : t({ es: "Pagar", en: "Pay" }))}</p>
                <p className="text-xs text-slate-500">
                  {l.kind === "tip" ? t({ es: "QR de propinas", en: "Tip QR" }) : t({ es: "Cualquier monto", en: "Any amount" })}
                  {l.member && <> · {l.member}</>}
                </p>
              </div>
              <span className="font-mono text-xs text-slate-400">{l.code}</span>
            </div>
            <QrImage code={l.code} size={320} className="mx-auto w-44 rounded-lg" />
            <div className="grid grid-cols-2 gap-2">
              <Link href={`/cobrar/qr/${l.id}/imprimir`} className="btn-secondary py-2 text-sm">
                🖨️ {t({ es: "Imprimir", en: "Print" })}
              </Link>
              <button
                type="button"
                className="btn-secondary py-2 text-sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(qrUrl(l.code));
                  setCopied(l.id);
                  setTimeout(() => setCopied(null), 1500);
                }}
              >
                {copied === l.id ? t({ es: "Copiado", en: "Copied" }) : t({ es: "Copiar enlace", en: "Copy link" })}
              </button>
            </div>
            {canManage && (
              <button type="button" className="w-full text-xs text-slate-500 underline" onClick={() => toggle(l.id, !l.active)}>
                {l.active ? t({ es: "Desactivar", en: "Turn off" }) : t({ es: "Activar de nuevo", en: "Turn back on" })}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
