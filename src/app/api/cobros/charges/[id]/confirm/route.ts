import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/http";

const body = z.object({ received: z.boolean() });

/**
 * Merchant confirms a real payment after seeing it in their bank app
 * ("Recibido"), or sends a reported one back to waiting ("No llegó").
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  if (!user) return jsonError(401, "Inicia sesión");
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(400, "Datos inválidos");

  // RLS: only the merchant who owns the charge can see it.
  const { data: charge } = await supabase.from("charges").select("id, mode").eq("id", id).maybeSingle();
  if (!charge) return jsonError(404, "Cobro no encontrado");
  if (charge.mode !== "live") return jsonError(400, "Los cobros de prueba se confirman solos");

  const db = createAdminClient();
  const result = parsed.data.received
    ? await db
        .from("charges")
        .update({ status: "paid", paid_at: new Date().toISOString(), paid_method: "zelle", paid_reference: null })
        .eq("id", id)
        .in("status", ["pending", "reported"])
        .select("id")
    : await db
        .from("charges")
        .update({ status: "pending", reported_at: null, payer_name: null, payer_user_id: null, paid_method: null, tip_amount: 0 })
        .eq("id", id)
        .eq("status", "reported")
        .select("id");
  if (result.error) return jsonError(500, result.error.message);
  if (!result.data?.length) return jsonError(409, "El cobro cambió de estado. Actualiza la página.");
  return NextResponse.json({ ok: true });
}
