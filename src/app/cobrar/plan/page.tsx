import { redirect } from "next/navigation";
import { loadBusiness } from "@/lib/business/context";
import { launchPricing, tierFor } from "@/lib/business/billing";
import { gatePage } from "@/components/business/Gate";
import { PlanPicker } from "@/components/business/PlanPicker";

export const dynamic = "force-dynamic";

/** Pick, pay for and manage the business's Avec plan (owner only). */
export default async function PlanPage({ searchParams }: { searchParams: Promise<{ activado?: string }> }) {
  const ctx = await loadBusiness();
  if (!ctx.business) redirect("/cobrar");
  const gate = gatePage(ctx, { roles: ["owner"] });
  if (gate) return gate;
  const m = ctx.business.merchant;
  const [tier, launch, { count: seatsUsed }] = await Promise.all([
    tierFor(ctx.db, m),
    launchPricing(ctx.db),
    ctx.db.from("merchant_members").select("id", { count: "exact", head: true }).eq("merchant_id", m.id),
  ]);
  const access = ctx.business.access;
  return (
    <PlanPicker
      tier={tier}
      launchUntil={launch.on ? launch.until : null}
      justPaid={(await searchParams).activado === "1"}
      billingReady={Boolean(process.env.STRIPE_SECRET_KEY?.trim())}
      seatsUsed={seatsUsed ?? 1}
      current={{
        plan: m.plan,
        status: m.subscription_status,
        accessOk: access.ok,
        accessReason: access.reason,
        until: access.ok ? access.until : m.access_until,
        cancelAtPeriodEnd: m.cancel_at_period_end,
        hasSubscription: Boolean(m.stripe_subscription_id),
        hasCustomer: Boolean(m.stripe_customer_id),
        lockedTier: m.price_tier,
      }}
    />
  );
}
