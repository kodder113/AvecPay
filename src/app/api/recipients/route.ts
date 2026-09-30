import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { recipientInput } from "@/lib/validation";
import { handleRouteError, jsonError } from "@/lib/http";
import { getT } from "@/lib/i18n/server";

export async function GET() {
  const { t } = await getT();
  const { supabase, user } = await requireUser();
  if (!user) return jsonError(401, t({ es: "Debes iniciar sesión", en: "Sign in required" }));
  const { data, error } = await supabase.from("recipients").select("*").order("created_at", { ascending: false });
  if (error) return handleRouteError(error);
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const { t } = await getT();
  const { supabase, user } = await requireUser();
  if (!user) return jsonError(401, t({ es: "Debes iniciar sesión", en: "Sign in required" }));
  try {
    const r = recipientInput.parse(await req.json());
    const { data, error } = await supabase
      .from("recipients")
      .insert({ user_id: user.id, full_name: r.fullName, email: r.email ?? null, phone: r.phone ?? null, country_code: r.countryCode })
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    return handleRouteError(e);
  }
}
