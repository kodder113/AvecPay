import Link from "next/link";
import { redirect } from "next/navigation";
import type { Ctx, Role } from "@/lib/business/context";
import { hasFeature, planWith, PLANS, type Feature } from "@/lib/business/plans";

/**
 * Common checks for business pages. Returns something to render instead of
 * the page (or redirects), or null when the page may render.
 */
export function gatePage(ctx: Ctx, opts: { roles?: Role[]; access?: boolean; feature?: Feature } = {}): React.ReactNode | null {
  const { t, business } = ctx;
  if (!business) redirect("/cobrar");
  if (business.deviceBlocked) return <DeviceBlocked ctx={ctx} />;
  if (opts.roles && !opts.roles.includes(business.role)) {
    return <Notice title={t({ es: "Solo para el dueño o gerente", en: "Owner or manager only" })} body={t({ es: "Tu rol no puede ver esta página.", en: "Your role can’t open this page." })} />;
  }
  if (opts.access && !business.access.ok) {
    if (business.role === "owner") redirect("/cobrar/plan");
    return (
      <Notice
        title={t({ es: "El plan del negocio no está activo", en: "The business plan isn’t active" })}
        body={t({ es: "Pídele al dueño que active o renueve el plan de Avec.", en: "Ask the owner to activate or renew the Avec plan." })}
      />
    );
  }
  if (opts.feature && !hasFeature(business.merchant.plan, opts.feature)) {
    const need = PLANS[planWith(opts.feature)].name;
    return (
      <Notice
        title={t({ es: `Disponible en el plan ${need}`, en: `Available on the ${need} plan` })}
        body={t({ es: "Mejora tu plan para usar esta función.", en: "Upgrade your plan to use this feature." })}
        cta={business.role === "owner" ? { href: "/cobrar/plan", label: t({ es: "Ver planes", en: "See plans" }) } : undefined}
      />
    );
  }
  return null;
}

export function Notice({ title, body, cta }: { title: string; body: string; cta?: { href: string; label: string } }) {
  return (
    <div className="card space-y-3 text-center">
      <p className="text-lg font-semibold">{title}</p>
      <p className="text-slate-600">{body}</p>
      {cta && (
        <Link href={cta.href} className="btn-primary">
          {cta.label}
        </Link>
      )}
    </div>
  );
}

function DeviceBlocked({ ctx }: { ctx: Ctx }) {
  const { t } = ctx;
  return (
    <div className="card space-y-3 text-center">
      <p className="text-4xl">📱</p>
      <p className="text-lg font-semibold">{t({ es: "Tu cuenta se abrió en otro dispositivo", en: "Your account was opened on another device" })}</p>
      <p className="text-slate-600">
        {t({
          es: "El plan Starter permite un dispositivo a la vez. Vuelve a entrar aquí y el otro se cerrará.",
          en: "The Starter plan allows one device at a time. Sign in again here and the other one will be signed out.",
        })}
      </p>
      <form action="/auth/signout" method="post">
        <button className="btn-primary w-full">{t({ es: "Entrar de nuevo aquí", en: "Sign in here again" })}</button>
      </form>
      {ctx.business?.role === "owner" && (
        <p className="text-sm text-slate-500">
          {t({ es: "¿Varias personas cobran?", en: "More than one person taking payments?" })}{" "}
          <Link href="/cobrar/plan" className="text-brand-ink underline">
            {t({ es: "El plan Team da un acceso a cada uno", en: "The Team plan gives each person a login" })}
          </Link>
        </p>
      )}
    </div>
  );
}

/** Starter accounts that look shared get a friendly upgrade prompt. */
export function SharingBanner({ ctx }: { ctx: Ctx }) {
  const { t, business } = ctx;
  if (!business?.sharingSuspected || business.role !== "owner") return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      {t({
        es: "Parece que varias personas usan esta cuenta. Con el plan Team cada técnico tiene su propio acceso y ves sus ventas por separado.",
        en: "It looks like several people use this account. With the Team plan each tech gets their own login and you see their sales separately.",
      })}{" "}
      <Link href="/cobrar/plan" className="font-semibold underline">
        {t({ es: "Mejorar a Team", en: "Upgrade to Team" })}
      </Link>
    </div>
  );
}
