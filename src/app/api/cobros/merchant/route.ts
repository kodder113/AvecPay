import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { METHODS } from "@/lib/cobros/methods";
import { handleRouteError, jsonError } from "@/lib/http";

const body = z.object({
  businessName: z.string().trim().min(2).max(80),
  methods: z.array(z.enum(METHODS)),
  tipsEnabled: z.boolean().default(true),
  mode: z.enum(["demo", "live"]).default("demo"),
  currency: z.enum(["HNL", "USD"]).default("HNL"),
  // Where customers send Zelle payments: US phone or email, and the name they'll see.
  zelleHandle: z.string().trim().max(80).optional().default(""),
  zelleName: z.string().trim().max(60).optional().default(""),
});

const zelleHandleOk = (h: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(h) || /^\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/.test(h);

/** Create or update the signed-in user's merchant profile and method switches. */
export async function POST(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return jsonError(401, "Inicia sesión");
  try {
    const input = body.parse(await req.json());
    if (input.methods.includes("zelle") && !zelleHandleOk(input.zelleHandle)) {
      return jsonError(400, "Escribe el teléfono (EE. UU.) o correo de tu Zelle");
    }
    const profile = {
      business_name: input.businessName,
      tips_enabled: input.tipsEnabled,
      mode: input.mode,
      currency: input.currency,
    };
    const { data: existing } = await supabase.from("merchants").select("id").eq("user_id", user.id).maybeSingle();

    let merchantId = existing?.id as string | undefined;
    if (merchantId) {
      const { error } = await supabase.from("merchants").update(profile).eq("id", merchantId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from("merchants")
        .insert({ user_id: user.id, ...profile })
        .select("id")
        .single();
      if (error || !data) throw error ?? new Error("No se pudo crear el comercio");
      merchantId = data.id;
    }

    const { error: mErr } = await supabase.from("merchant_methods").upsert(
      METHODS.map((method) => ({
        merchant_id: merchantId,
        method,
        enabled: input.methods.includes(method),
        details: method === "zelle" ? { handle: input.zelleHandle, name: input.zelleName || input.businessName } : {},
      })),
      { onConflict: "merchant_id,method" },
    );
    if (mErr) throw mErr;
    return NextResponse.json({ id: merchantId });
  } catch (e) {
    return handleRouteError(e);
  }
}
