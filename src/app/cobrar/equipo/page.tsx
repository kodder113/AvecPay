import { loadBusiness } from "@/lib/business/context";
import { listMembers, memberLabel } from "@/lib/business/members";
import { hasFeature, planWith, PLANS, seatsFor } from "@/lib/business/plans";
import { gatePage, Notice } from "@/components/business/Gate";
import { TeamManager } from "@/components/business/TeamManager";

/** Team members, roles and invites. Owners manage; managers can look. */
export default async function TeamPage() {
  const ctx = await loadBusiness();
  const gate = gatePage(ctx, { roles: ["owner", "manager"] });
  if (gate) return gate;
  const { t, db } = ctx;
  const business = ctx.business!;
  const m = business.merchant;
  if (!hasFeature(m.plan, "team")) {
    return (
      <Notice
        title={t({ es: `Tu equipo, en el plan ${PLANS[planWith("team")].name}`, en: `Your team, on the ${PLANS[planWith("team")].name} plan` })}
        body={t({
          es: "Dale a cada técnico su propio acceso y su propio QR, y ve sus ventas y propinas por separado. Hasta 5 personas en Team, 15 en Business.",
          en: "Give each tech their own login and QR, and see their sales and tips separately. Up to 5 people on Team, 15 on Business.",
        })}
        cta={business.role === "owner" ? { href: "/cobrar/plan", label: t({ es: "Ver planes", en: "See plans" }) } : undefined}
      />
    );
  }
  const members = await listMembers(db, m.id);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t({ es: "Equipo", en: "Team" })}</h1>
        <p className="text-slate-600">
          {t({ es: `${members.length} de ${seatsFor(m.plan)} usuarios en tu plan.`, en: `${members.length} of ${seatsFor(m.plan)} users on your plan.` })}
        </p>
      </div>
      <TeamManager
        canManage={business.role === "owner"}
        full={members.length >= seatsFor(m.plan)}
        members={members.map((x) => ({ id: x.id, name: memberLabel(x), email: x.email, role: x.role, status: x.status }))}
      />
    </div>
  );
}
