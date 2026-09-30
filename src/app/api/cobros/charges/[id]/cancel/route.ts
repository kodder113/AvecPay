import { NextResponse } from "next/server";
import { requireBusiness } from "@/lib/business/context";
import { visibleCharge } from "@/lib/business/visibility";
import { jsonError } from "@/lib/http";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await requireBusiness();
  if (!g.ok) return g.res;
  const { db, t, user, business } = g.ctx;
  const charge = await visibleCharge(db, business, user.id, id, "id");
  if (!charge) return jsonError(404, t({ es: "Cobro no encontrado", en: "Charge not found" }));
  const { data, error } = await db.from("charges").update({ status: "cancelled" }).eq("id", id).eq("status", "pending").select("id");
  if (error) return jsonError(500, error.message);
  if (!data?.length) return jsonError(409, t({ es: "Este cobro ya no está pendiente", en: "This charge is no longer pending" }));
  return NextResponse.json({ ok: true });
}
