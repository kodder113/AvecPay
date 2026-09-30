import { NextResponse } from "next/server";
import { getT } from "@/lib/i18n/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { liveMethods, resolveMethods } from "@/lib/cobros/methods";
import { stripeEnabledFor } from "@/lib/stripe";
import { generateChargeCode } from "@/lib/cobros/code";
import { handleRouteError, jsonError } from "@/lib/http";

const body = z.object({
  amount: z.coerce.number().positive().max(1_000_000).multipleOf(0.01),
  description: z.string().trim().max(140).optional(),
});

/** Create a charge (one QR). Offered methods = partner switch ∩ merchant switch. */
export async function POST(req: Request) {
  const { t } = await getT();
  const { supabase, user } = await requireUser();
  if (!user) return jsonError(401, t({ es: "Inicia sesión", en: "Sign in" }));
  try {
    const input = body.parse(await req.json());
    const { data: merchant } = await supabase
      .from("merchants")
      .select("id, currency, mode, partner_id, tips_enabled, merchant_methods(method, enabled, details)")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!merchant) return jsonError(400, t({ es: "Primero configura tu comercio", en: "Set up your business first" }));

    const { data: partner } = await supabase.from("partners").select("allowed_methods").eq("id", merchant.partner_id).single();
    const methods = merchant.merchant_methods ?? [];
    const enabled = methods.filter((m) => m.enabled).map((m) => m.method as string);
    let allowed = resolveMethods(partner?.allowed_methods ?? [], enabled);
    if (merchant.mode === "live") {
      // Real money: only methods that actually work live. Zelle needs a handle;
      // card needs this merchant's Stripe and dollars.
      const zelle = methods.find((m) => m.method === "zelle")?.details as { handle?: string } | undefined;
      const live = liveMethods(stripeEnabledFor(user.email));
      allowed = allowed.filter(
        (m) => live.includes(m) && (m !== "zelle" || Boolean(zelle?.handle)) && (m !== "card" || merchant.currency === "USD"),
      );
      if (!allowed.length) return jsonError(400, t({ es: "En modo real activa Zelle con tu teléfono o correo en Ajustes", en: "In live mode, turn on Zelle with your phone or email in Settings" }));
    }
    if (!allowed.length) return jsonError(400, t({ es: "Activa al menos un método de pago en Ajustes", en: "Turn on at least one payment method in Settings" }));

    // Charges are written server-side only; retry on the rare code collision.
    const db = createAdminClient();
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await db
        .from("charges")
        .insert({
          merchant_id: merchant.id,
          code: generateChargeCode(),
          mode: merchant.mode,
          amount: input.amount,
          currency: merchant.currency,
          description: input.description || null,
          allowed_methods: allowed,
          tips_allowed: merchant.tips_enabled,
        })
        .select("id, code")
        .single();
      if (!error && data) return NextResponse.json(data, { status: 201 });
      if (error?.code !== "23505") throw error;
    }
    throw new Error(t({ es: "No se pudo generar un código único", en: "Couldn’t generate a unique code" }));
  } catch (e) {
    return handleRouteError(e);
  }
}
