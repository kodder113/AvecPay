import { NextResponse } from "next/server";
import { requireBusiness } from "@/lib/business/context";
import { createAccountLink, createConnectedAccount, StripeError } from "@/lib/stripe";
import { jsonError } from "@/lib/http";

/**
 * Owner connects the business's own Stripe account (created on Stripe's
 * sign-up page, Standard type). Stripe verifies the business and pays out
 * to its bank; Avec never holds the money.
 */
async function onboardingUrl(req: Request): Promise<{ url: string } | { res: Response }> {
  const g = await requireBusiness({ roles: ["owner"] });
  if (!g.ok) return { res: g.res };
  const { db, t, user, business } = g.ctx;
  const m = business.merchant;
  const origin = new URL(req.url).origin;
  try {
    let account = m.stripe_account_id;
    if (!account) {
      const created = await createConnectedAccount({ email: user.email ?? "", businessName: m.business_name, merchantId: m.id });
      account = created.id;
      await db.from("merchants").update({ stripe_account_id: account }).eq("id", m.id);
    }
    const url = await createAccountLink(account, `${origin}/api/connect/onboard`, `${origin}/cobrar/ajustes?stripe=return`);
    return { url };
  } catch (e) {
    console.error("connect onboard", e);
    if (e instanceof StripeError && e.code === "not_configured") return { res: jsonError(503, t({ es: "Stripe aún no está configurado.", en: "Stripe isn't set up yet." })) };
    return { res: jsonError(502, t({ es: "No se pudo abrir Stripe. Intenta de nuevo.", en: "Couldn't open Stripe. Try again." })) };
  }
}

export async function POST(req: Request) {
  const r = await onboardingUrl(req);
  return "res" in r ? r.res : NextResponse.json({ url: r.url });
}

/** Stripe's refresh_url: an expired sign-up link sends the owner back here for a new one. */
export async function GET(req: Request) {
  const r = await onboardingUrl(req);
  return "res" in r ? NextResponse.redirect(new URL("/cobrar/ajustes", req.url)) : NextResponse.redirect(r.url);
}
