import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveMethods } from "@/lib/cobros/methods";
import { generateChargeCode } from "@/lib/cobros/code";
import { handleRouteError, jsonError } from "@/lib/http";

const body = z.object({
  amount: z.coerce.number().positive().max(1_000_000).multipleOf(0.01),
  description: z.string().trim().max(140).optional(),
});

/** Create a charge (one QR). Offered methods = partner switch ∩ merchant switch. */
export async function POST(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return jsonError(401, "Inicia sesión");
  try {
    const input = body.parse(await req.json());
    const { data: merchant } = await supabase
      .from("merchants")
      .select("id, currency, partner_id, merchant_methods(method, enabled)")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!merchant) return jsonError(400, "Primero configura tu comercio");

    const { data: partner } = await supabase.from("partners").select("allowed_methods").eq("id", merchant.partner_id).single();
    const enabled = (merchant.merchant_methods ?? []).filter((m) => m.enabled).map((m) => m.method as string);
    const allowed = resolveMethods(partner?.allowed_methods ?? [], enabled);
    if (!allowed.length) return jsonError(400, "Activa al menos un método de pago en Ajustes");

    // Charges are written server-side only; retry on the rare code collision.
    const db = createAdminClient();
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await db
        .from("charges")
        .insert({
          merchant_id: merchant.id,
          code: generateChargeCode(),
          mode: "demo",
          amount: input.amount,
          currency: merchant.currency,
          description: input.description || null,
          allowed_methods: allowed,
        })
        .select("id, code")
        .single();
      if (!error && data) return NextResponse.json(data, { status: 201 });
      if (error?.code !== "23505") throw error;
    }
    throw new Error("No se pudo generar un código único");
  } catch (e) {
    return handleRouteError(e);
  }
}
