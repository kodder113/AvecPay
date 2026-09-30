"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n/LangProvider";

interface Member {
  id: string;
  name: string;
  email: string;
  role: "owner" | "manager" | "staff";
  status: "invited" | "active";
}

export function TeamManager({ members, canManage, full }: { members: Member[]; canManage: boolean; full: boolean }) {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"staff" | "manager">("staff");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const roleName = (r: Member["role"]) =>
    r === "owner" ? t({ es: "Dueño", en: "Owner" }) : r === "manager" ? t({ es: "Gerente", en: "Manager" }) : t({ es: "Técnico / cajero", en: "Tech / cashier" });

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await fetch("/api/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, name, role }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? t({ es: "No se pudo invitar", en: "Couldn't invite" }));
    setNotice(
      data.emailed
        ? t({ es: `Invitación enviada a ${email}.`, en: `Invite sent to ${email}.` })
        : t({ es: `Listo. Pídele a ${email} que entre en ${data.joinUrl} con ese correo.`, en: `Done. Ask ${email} to sign in at ${data.joinUrl} with that email.` }),
    );
    setEmail("");
    setName("");
    router.refresh();
  }

  async function act(id: string, method: "PATCH" | "DELETE", body?: unknown) {
    setError(null);
    const res = await fetch(`/api/team/${id}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Error");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {members.map((m) => (
          <li key={m.id} className="card flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">
                {m.name}
                {m.status === "invited" && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{t({ es: "Invitado", en: "Invited" })}</span>}
              </p>
              <p className="truncate text-sm text-slate-500">{m.email}</p>
            </div>
            {canManage && m.role !== "owner" ? (
              <div className="flex items-center gap-2">
                <select className="input py-2" value={m.role} onChange={(e) => act(m.id, "PATCH", { role: e.target.value })} aria-label={t({ es: `Rol de ${m.name}`, en: `Role of ${m.name}` })}>
                  <option value="staff">{roleName("staff")}</option>
                  <option value="manager">{roleName("manager")}</option>
                </select>
                <button type="button" className="text-sm text-red-600 underline" onClick={() => act(m.id, "DELETE")}>
                  {m.status === "invited" ? t({ es: "Cancelar", en: "Cancel" }) : t({ es: "Quitar", en: "Remove" })}
                </button>
              </div>
            ) : (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold">{roleName(m.role)}</span>
            )}
          </li>
        ))}
      </ul>

      {canManage &&
        (full ? (
          <p className="card text-sm text-slate-600">{t({ es: "Tu plan está lleno. Mejora tu plan para invitar a más personas.", en: "Your plan is full. Upgrade to invite more people." })}</p>
        ) : (
          <form onSubmit={invite} className="card space-y-3">
            <h2 className="font-semibold">{t({ es: "Invitar a alguien", en: "Invite someone" })}</h2>
            <input className="input" type="email" inputMode="email" required placeholder={t({ es: "Correo", en: "Email" })} value={email} onChange={(e) => setEmail(e.target.value)} aria-label={t({ es: "Correo", en: "Email" })} />
            <input className="input" placeholder={t({ es: "Nombre (ej. Miguel)", en: "Name (e.g. Miguel)" })} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label={t({ es: "Nombre", en: "Name" })} />
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as "staff" | "manager")} aria-label={t({ es: "Rol", en: "Role" })}>
              <option value="staff">{roleName("staff")} · {t({ es: "cobra y ve sus ventas", en: "charges and sees their own sales" })}</option>
              <option value="manager">{roleName("manager")} · {t({ es: "ve todo el equipo", en: "sees the whole team" })}</option>
            </select>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? t({ es: "Invitando…", en: "Inviting…" }) : t({ es: "Enviar invitación", en: "Send invite" })}
            </button>
          </form>
        ))}
      {notice && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      {error && !canManage && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
