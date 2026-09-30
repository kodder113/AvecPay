import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChargeLive, type ChargeView } from "@/components/cobros/ChargeLive";
import { ModePill } from "@/components/cobros/DemoPill";

export default async function ChargePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: charge } = await supabase
    .from("charges")
    .select("id, code, mode, status, reported_at, amount, tip_amount, currency, description, paid_method, paid_reference, payer_name, paid_at, expires_at, merchants(business_name)")
    .eq("id", id)
    .maybeSingle();
  if (!charge) notFound();
  const merchant = (Array.isArray(charge.merchants) ? charge.merchants[0] : charge.merchants) as { business_name: string } | null;
  return (
    <div className="space-y-3">
      <ModePill mode={charge.mode} />
      <ChargeLive initial={charge as unknown as ChargeView} businessName={merchant?.business_name ?? ""} />
    </div>
  );
}
