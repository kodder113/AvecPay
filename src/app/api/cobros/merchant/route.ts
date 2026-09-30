import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { METHODS } from "@/lib/cobros/methods";
import { handleRouteError, jsonError } from "@/lib/http";

const body = z.object({
  businessName: z.string().trim().min(2).max(80),
  methods: z.array(z.enum(METHODS)),
  tipsEnabled: z.boolean().default(true),
});

/** Create or update the signed-in user's merchant profile and method switches. */
export async function POST(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return jsonError(401, "Inicia sesión");
  try {
    const input = body.parse(await req.json());
    const { data: existing } = await supabase.from("merchants").select("id").eq("user_id", user.id).maybeSingle();

    let merchantId = existing?.id as string | undefined;
    if (merchantId) {
      const { error } = await supabase.from("merchants").update({ business_name: input.businessName, tips_enabled: input.tipsEnabled }).eq("id", merchantId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from("merchants")
        .insert({ user_id: user.id, business_name: input.businessName, tips_enabled: input.tipsEnabled })
        .select("id")
        .single();
      if (error || !data) throw error ?? new Error("No se pudo crear el comercio");
      merchantId = data.id;
    }

    const { error: mErr } = await supabase.from("merchant_methods").upsert(
      METHODS.map((method) => ({ merchant_id: merchantId, method, enabled: input.methods.includes(method) })),
      { onConflict: "merchant_id,method" },
    );
    if (mErr) throw mErr;
    return NextResponse.json({ id: merchantId });
  } catch (e) {
    return handleRouteError(e);
  }
}
