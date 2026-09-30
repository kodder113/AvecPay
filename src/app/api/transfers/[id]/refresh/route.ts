import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { getProvider } from "@/lib/providers/registry";
import { applyProviderOrder, pickBoundOrder } from "@/lib/transfers";
import { handleRouteError, jsonError } from "@/lib/http";
import { getT } from "@/lib/i18n/server";

/** Pulls the latest order state from the provider (backup for missed webhooks). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await getT();
  const { supabase, user } = await requireUser();
  if (!user) return jsonError(401, t({ es: "Debes iniciar sesión", en: "Sign in required" }));

  // RLS: only returns the row if the user owns it.
  const { data: transfer } = await supabase.from("transfers").select("id, provider, provider_transaction_id").eq("id", id).single();
  if (!transfer) return jsonError(404, t({ es: "Envío no encontrado", en: "Transfer not found" }));

  try {
    const orders = await getProvider(transfer.provider).listOrdersByTransferId(transfer.id);
    const order = pickBoundOrder(orders, transfer.provider_transaction_id);
    if (!order) {
      const reason = t({
        es: "El destinatario aún no ha creado la orden con el proveedor",
        en: "Recipient has not created the provider order yet",
      });
      return NextResponse.json({ updated: false, reason });
    }
    const { rejection } = await applyProviderOrder(transfer.id, order, "poll");
    return NextResponse.json({ updated: true, rejection });
  } catch (e) {
    return handleRouteError(e);
  }
}
