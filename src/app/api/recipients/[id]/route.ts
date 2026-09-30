import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { jsonError } from "@/lib/http";
import { getT } from "@/lib/i18n/server";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await getT();
  const { supabase, user } = await requireUser();
  if (!user) return jsonError(401, t({ es: "Debes iniciar sesión", en: "Sign in required" }));
  const { error } = await supabase.from("recipients").delete().eq("id", id);
  // 23503 = still referenced by a transfer (kept for history).
  if (error?.code === "23503") return jsonError(
      409,
      t({ es: "Este destinatario tiene envíos y no se puede eliminar.", en: "This recipient has transfers and cannot be deleted." }),
    );
  if (error) return jsonError(500, error.message);
  return NextResponse.json({ ok: true });
}
