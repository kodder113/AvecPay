import "server-only";
import type { Db } from "./context";

export interface MemberRow {
  id: string;
  user_id: string | null;
  email: string;
  display_name: string | null;
  role: "owner" | "manager" | "staff";
  status: "invited" | "active";
  created_at: string;
}

export async function listMembers(db: Db, merchantId: string): Promise<MemberRow[]> {
  const { data } = await db
    .from("merchant_members")
    .select("id, user_id, email, display_name, role, status, created_at")
    .eq("merchant_id", merchantId)
    .order("created_at");
  return (data ?? []) as MemberRow[];
}

export function memberLabel(m: Pick<MemberRow, "display_name" | "email">): string {
  return m.display_name?.trim() || m.email.split("@")[0];
}

/** user id → name to show, for "who made this sale". */
export async function memberNames(db: Db, merchantId: string): Promise<Map<string, string>> {
  const members = await listMembers(db, merchantId);
  return new Map(members.filter((m) => m.user_id).map((m) => [m.user_id!, memberLabel(m)]));
}
