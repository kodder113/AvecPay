import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { jsonError } from "@/lib/http";

export async function POST() {
  const { supabase, user } = await requireUser();
  if (!user) return jsonError(401, "Inicia sesión");
  const { data, error } = await supabase.rpc("demo_reset_account");
  if (error) return jsonError(500, "No se pudo recargar la cuenta");
  return NextResponse.json(data);
}
