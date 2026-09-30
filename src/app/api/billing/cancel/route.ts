import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusiness } from "@/lib/business/context";
import { syncSubscription } from "@/lib/business/billing";
import { setCancelAtPeriodEnd } from "@/lib/stripe";
import { jsonError } from "@/lib/http";

const body = z.object({ cancel: z.boolean() });

/** Cancel at the end of the paid month, or undo that. */
export async function POST(req: Request) {
  const g = await requireBusiness({ roles: ["owner"] });
  if (!g.ok) return g.res;
  const { db, t, business } = g.ctx;
  const m = business.merchant;
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(400, t({ es: "Datos inválidos", en: "Invalid data" }));
  if (!m.stripe_subscription_id) return jsonError(409, t({ es: "No hay una suscripción activa.", en: "There's no active subscription." }));
  try {
    const sub = await setCancelAtPeriodEnd(m.stripe_subscription_id, parsed.data.cancel);
    await syncSubscription(db, { ...sub, metadata: { ...sub.metadata, merchant_id: m.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("billing cancel", e);
    return jsonError(502, t({ es: "No se pudo actualizar. Intenta de nuevo.", en: "Couldn't update. Try again." }));
  }
}
