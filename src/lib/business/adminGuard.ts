import "server-only";
import { requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "./admin";
import { jsonError } from "@/lib/http";

/** For admin API routes: the signed-in Avec admin, or a 403 response. */
export async function requireAdmin() {
  const { user } = await requireUser();
  if (!user || !isAdmin(user.email)) return { ok: false as const, res: jsonError(403, "Admins only") };
  return { ok: true as const, user, db: createAdminClient() };
}
