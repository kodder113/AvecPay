import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusiness } from "@/lib/business/context";
import { hasFeature } from "@/lib/business/plans";
import { chargeMethods, insertCharge } from "@/lib/business/charges";
import { handleRouteError, jsonError } from "@/lib/http";

const body = z.object({
  amount: z.coerce.number().positive().max(1_000_000).multipleOf(0.01),
  description: z.string().trim().max(140).optional(),
  kind: z.enum(["quick", "ticket"]).default("quick"),
  ticketRef: z.string().trim().max(40).optional(),
  customerName: z.string().trim().max(80).optional(),
  customerEmail: z.union([z.literal(""), z.string().trim().email().max(200)]).optional(),
  validDays: z.coerce.number().int().min(1).max(30).default(7),
});

/** Create a charge (one QR). Any team member can charge while the plan is active. */
export async function POST(req: Request) {
  const g = await requireBusiness({ access: true });
  if (!g.ok) return g.res;
  const { db, t, user, business } = g.ctx;
  const m = business.merchant;
  try {
    const input = body.parse(await req.json());
    if (input.kind === "ticket") {
      if (!hasFeature(m.plan, "ticket_qr")) return jsonError(402, t({ es: "Los tickets están en los planes Team y Business", en: "Tickets are on the Team and Business plans" }));
      if (!input.ticketRef) return jsonError(400, t({ es: "Escribe el número de ticket", en: "Enter the ticket number" }));
    }
    const allowed = await chargeMethods(db, m);
    if (!allowed.length) {
      return jsonError(
        400,
        m.mode === "live"
          ? t({ es: "En modo real activa un método (Zelle, Venmo, Cash App, PayPal o tarjeta) en Ajustes", en: "In live mode, turn on a method (Zelle, Venmo, Cash App, PayPal or card) in Settings" })
          : t({ es: "Activa al menos un método de pago en Ajustes", en: "Turn on at least one payment method in Settings" }),
      );
    }
    const charge = await insertCharge(db, m, allowed, {
      amount: input.amount,
      description: input.description,
      kind: input.kind,
      ticketRef: input.kind === "ticket" ? input.ticketRef : null,
      customerName: input.kind === "ticket" ? input.customerName : null,
      customerEmail: input.kind === "ticket" ? input.customerEmail || null : null,
      createdBy: user.id,
      validMinutes: input.kind === "ticket" ? input.validDays * 24 * 60 : 30,
    });
    return NextResponse.json(charge, { status: 201 });
  } catch (e) {
    return handleRouteError(e);
  }
}
