import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/http";

/** Status only, for the customer's page while waiting for the merchant. */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  if (!/^[A-Z2-9]{8}$/.test(code)) return jsonError(400, "Código inválido");
  const { data } = await createAdminClient().from("charges").select("status").eq("code", code).maybeSingle();
  if (!data) return jsonError(404, "No existe");
  return NextResponse.json({ status: data.status }, { headers: { "Cache-Control": "no-store" } });
}
