import { notFound } from "next/navigation";
import { loadBusiness, seesAllCharges } from "@/lib/business/context";
import { memberNames } from "@/lib/business/members";
import { gatePage } from "@/components/business/Gate";
import { PrintSign } from "@/components/business/PrintSign";

/** A printable sign for a permanent QR (Print → Save as PDF works too). */
export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await loadBusiness();
  const gate = gatePage(ctx);
  if (gate) return gate;
  const business = ctx.business!;
  const { data: link } = await ctx.db.from("pay_links").select("code, kind, label, member_user_id").eq("id", id).eq("merchant_id", business.merchant.id).maybeSingle();
  if (!link || (!seesAllCharges(business.role) && link.member_user_id !== ctx.user!.id)) notFound();
  const names = link.member_user_id ? await memberNames(ctx.db, business.merchant.id) : new Map<string, string>();
  const { data: methods } = await ctx.db.from("merchant_methods").select("method").eq("merchant_id", business.merchant.id).eq("enabled", true);
  return (
    <PrintSign
      code={link.code}
      tip={link.kind === "tip"}
      business={business.merchant.business_name}
      label={link.label}
      member={link.member_user_id ? (names.get(link.member_user_id) ?? null) : null}
      methods={(methods ?? []).map((r) => r.method as string)}
    />
  );
}
