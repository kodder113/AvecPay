import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusiness } from "@/lib/business/context";
import { jsonError } from "@/lib/http";

/** Change a member's role (owner only; the owner can't be changed). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await requireBusiness({ roles: ["owner"] });
  if (!g.ok) return g.res;
  const { db, t, business } = g.ctx;
  const parsed = z.object({ role: z.enum(["manager", "staff"]) }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(400, t({ es: "Datos inválidos", en: "Invalid data" }));
  const { data, error } = await db.from("merchant_members").update({ role: parsed.data.role }).eq("id", id).eq("merchant_id", business.merchant.id).neq("role", "owner").select("id");
  if (error) return jsonError(500, error.message);
  if (!data?.length) return jsonError(404, t({ es: "Miembro no encontrado", en: "Member not found" }));
  return NextResponse.json({ ok: true });
}

/** Remove a member or cancel an invite. Their past sales stay in the history. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await requireBusiness({ roles: ["owner"] });
  if (!g.ok) return g.res;
  const { db, t, business } = g.ctx;
  const { data, error } = await db.from("merchant_members").delete().eq("id", id).eq("merchant_id", business.merchant.id).neq("role", "owner").select("id");
  if (error) return jsonError(500, error.message);
  if (!data?.length) return jsonError(404, t({ es: "Miembro no encontrado", en: "Member not found" }));
  return NextResponse.json({ ok: true });
}
