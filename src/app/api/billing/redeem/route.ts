import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusiness } from "@/lib/business/context";
import { redeemAccessCode } from "@/lib/business/billing";
import { promoErrorMessage } from "@/lib/business/messages";
import { jsonError } from "@/lib/http";

const body = z.object({ code: z.string().min(1).max(40) });

/**
 * Owner enters a code. Activation (paid in person) and trial codes turn the
 * plan on right away; discount codes are returned to be used at checkout.
 */
export async function POST(req: Request) {
  const g = await requireBusiness({ roles: ["owner"] });
  if (!g.ok) return g.res;
  const { db, t, business } = g.ctx;
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(400, t({ es: "Escribe un código", en: "Enter a code" }));
  const result = await redeemAccessCode(db, business.merchant, parsed.data.code);
  if (!result.ok) return jsonError(400, promoErrorMessage(result.error, t));
  const p = result.promo;
  return NextResponse.json({ kind: p.kind, code: p.code, plan: p.plan, months: p.months, days: p.days, percentOff: p.percent_off });
}
