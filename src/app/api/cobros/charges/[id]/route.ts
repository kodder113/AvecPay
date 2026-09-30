import { NextResponse } from "next/server";
import { getT } from "@/lib/i18n/server";
import { requireUser } from "@/lib/supabase/server";
import { jsonError } from "@/lib/http";

/** Charge status for the merchant's live screen (RLS: merchant only). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { t } = await getT();
  const { id } = await params;
  const { supabase, user } = await requireUser();
  if (!user) return jsonError(401, t({ es: "Inicia sesión", en: "Sign in" }));
  const { data } = await supabase
    .from("charges")
    .select("id, code, mode, status, amount, tip_amount, currency, reported_at, paid_method, paid_reference, payer_name, paid_at, expires_at")
    .eq("id", id)
    .maybeSingle();
  if (!data) return jsonError(404, t({ es: "Cobro no encontrado", en: "Charge not found" }));
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
