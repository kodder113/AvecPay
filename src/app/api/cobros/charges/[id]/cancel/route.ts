import { NextResponse } from "next/server";
import { getT } from "@/lib/i18n/server";
import { requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/http";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { t } = await getT();
  const { id } = await params;
  const { supabase, user } = await requireUser();
  if (!user) return jsonError(401, t({ es: "Inicia sesión", en: "Sign in" }));
  // RLS: only returns the charge if it belongs to this merchant.
  const { data: charge } = await supabase.from("charges").select("id").eq("id", id).maybeSingle();
  if (!charge) return jsonError(404, t({ es: "Cobro no encontrado", en: "Charge not found" }));
  const { data, error } = await createAdminClient()
    .from("charges")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (error) return jsonError(500, error.message);
  if (!data?.length) return jsonError(409, t({ es: "Este cobro ya no está pendiente", en: "This charge is no longer pending" }));
  return NextResponse.json({ ok: true });
}
