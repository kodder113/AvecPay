import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { getProvider } from "@/lib/providers/registry";
import { applyProviderOrder, pickBoundOrder } from "@/lib/transfers";
import { handleRouteError, jsonError } from "@/lib/http";

/** Pulls the latest order state from the provider (backup for missed webhooks). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  if (!user) return jsonError(401, "Sign in required");

  // RLS: only returns the row if the user owns it.
  const { data: transfer } = await supabase.from("transfers").select("id, provider, provider_transaction_id").eq("id", id).single();
  if (!transfer) return jsonError(404, "Transfer not found");

  try {
    const orders = await getProvider(transfer.provider).listOrdersByTransferId(transfer.id);
    const order = pickBoundOrder(orders, transfer.provider_transaction_id);
    if (!order) return NextResponse.json({ updated: false, reason: "Recipient has not created the provider order yet" });
    const { rejection } = await applyProviderOrder(transfer.id, order, "poll");
    return NextResponse.json({ updated: true, rejection });
  } catch (e) {
    return handleRouteError(e);
  }
}
