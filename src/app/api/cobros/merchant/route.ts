import { NextResponse } from "next/server";
import { z } from "zod";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadBusiness } from "@/lib/business/context";
import { METHODS, methodInfo } from "@/lib/cobros/methods";
import { HANDLE_METHODS, normalizeHandle } from "@/lib/cobros/handles";
import { handleRouteError, jsonError } from "@/lib/http";

const body = z.object({
  businessName: z.string().trim().min(2).max(80),
  methods: z.array(z.enum(METHODS)),
  tipsEnabled: z.boolean().default(true),
  mode: z.enum(["demo", "live"]).default("demo"),
  currency: z.enum(["HNL", "USD"]).default("USD"),
  // Where customers pay by app: Zelle phone/email, Venmo, Cash App, PayPal.
  handles: z.record(z.string(), z.string().max(80)).default({}),
  // The name customers see in Zelle.
  zelleName: z.string().trim().max(60).optional().default(""),
});

/**
 * Create the signed-in user's business (they become its owner), or update
 * it (owner only): profile, mode, currency, payment-method switches, handles.
 */
export async function POST(req: Request) {
  const { lang, t } = await getT();
  const ctx = await loadBusiness();
  if (!ctx.user) return jsonError(401, t({ es: "Inicia sesión", en: "Sign in" }));
  if (ctx.business && ctx.business.role !== "owner") return jsonError(403, t({ es: "Solo el dueño puede cambiar los ajustes", en: "Only the owner can change settings" }));
  try {
    const input = body.parse(await req.json());
    const handles: Record<string, string> = {};
    for (const m of HANDLE_METHODS) {
      if (!input.methods.includes(m)) continue;
      const h = normalizeHandle(m, input.handles[m] ?? "");
      // Demo mode uses play money, so a handle is only needed once it's live.
      if (!h && input.mode === "demo" && !(input.handles[m] ?? "").trim()) continue;
      if (!h) {
        const label = methodInfo(lang)[m].label;
        return jsonError(
          400,
          m === "zelle"
            ? t({ es: "Escribe el teléfono (EE. UU.) o correo de tu Zelle", en: "Enter your Zelle phone (US) or email" })
            : t({ es: `Escribe tu usuario de ${label}`, en: `Enter your ${label} username` }),
        );
      }
      handles[m] = h;
    }

    const db = createAdminClient();
    const profile = { business_name: input.businessName, tips_enabled: input.tipsEnabled, mode: input.mode, currency: input.currency };
    let merchantId = ctx.business?.merchant.id;
    if (merchantId) {
      const { error } = await db.from("merchants").update(profile).eq("id", merchantId);
      if (error) throw error;
    } else {
      // New business: created as the user (RLS insert rule), then the owner joins as a member.
      const supabase = await createClient();
      const { data, error } = await supabase.from("merchants").insert({ user_id: ctx.user.id, ...profile }).select("id").single();
      if (error || !data) throw error ?? new Error(t({ es: "No se pudo crear el comercio", en: "Couldn’t create the business" }));
      merchantId = data.id as string;
      const { error: mErr } = await db
        .from("merchant_members")
        .insert({ merchant_id: merchantId, user_id: ctx.user.id, email: (ctx.user.email ?? "").toLowerCase(), role: "owner", status: "active" });
      if (mErr) throw mErr;
    }

    const { data: existing } = await db.from("merchant_methods").select("method, details").eq("merchant_id", merchantId);
    const oldDetails = new Map((existing ?? []).map((r) => [r.method as string, r.details as Record<string, string>]));
    const { error: mErr } = await db.from("merchant_methods").upsert(
      METHODS.map((method) => {
        let details: Record<string, string> = oldDetails.get(method) ?? {};
        if (handles[method]) details = { ...details, handle: handles[method] };
        if (method === "zelle" && handles.zelle) details = { ...details, name: input.zelleName || input.businessName };
        return { merchant_id: merchantId, method, enabled: input.methods.includes(method), details };
      }),
      { onConflict: "merchant_id,method" },
    );
    if (mErr) throw mErr;
    return NextResponse.json({ id: merchantId, created: !ctx.business });
  } catch (e) {
    return handleRouteError(e);
  }
}
