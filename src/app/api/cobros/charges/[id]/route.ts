import { NextResponse } from "next/server";
import { requireBusiness } from "@/lib/business/context";
import { CHARGE_VIEW_COLUMNS, visibleCharge } from "@/lib/business/visibility";
import { jsonError } from "@/lib/http";

/** Charge status for the merchant's live screen. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await requireBusiness();
  if (!g.ok) return g.res;
  const { db, t, user, business } = g.ctx;
  const data = await visibleCharge(db, business, user.id, id, CHARGE_VIEW_COLUMNS);
  if (!data) return jsonError(404, t({ es: "Cobro no encontrado", en: "Charge not found" }));
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
