import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { jsonError } from "@/lib/http";
import { getT } from "@/lib/i18n/server";

export async function POST() {
  const { t } = await getT();
  const { supabase, user } = await requireUser();
  if (!user) return jsonError(401, t({ es: "Inicia sesión", en: "Please sign in" }));
  const { data, error } = await supabase.rpc("demo_reset_account");
  if (error) return jsonError(500, t({ es: "No se pudo recargar la cuenta", en: "Couldn't refill the account" }));
  return NextResponse.json(data);
}
