import { notFound } from "next/navigation";
import { loadBusiness } from "@/lib/business/context";
import { CHARGE_VIEW_COLUMNS, visibleCharge } from "@/lib/business/visibility";
import { gatePage } from "@/components/business/Gate";
import { ChargeLive, type ChargeView } from "@/components/cobros/ChargeLive";
import { ModePill } from "@/components/cobros/DemoPill";

export default async function ChargePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await loadBusiness();
  const gate = gatePage(ctx);
  if (gate) return gate;
  const business = ctx.business!;
  const charge = await visibleCharge<ChargeView>(ctx.db, business, ctx.user!.id, id, CHARGE_VIEW_COLUMNS);
  if (!charge) notFound();
  return (
    <div className="space-y-3">
      <ModePill mode={charge.mode ?? "demo"} />
      <ChargeLive initial={charge} businessName={business.merchant.business_name} />
    </div>
  );
}
