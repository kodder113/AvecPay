import { requireBusiness } from "@/lib/business/context";
import { memberNames } from "@/lib/business/members";

const csv = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // Quote everything; neutralize spreadsheet formulas.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

/** CSV of charges for the accountant (Business plan; owners and managers). */
export async function GET(req: Request) {
  const g = await requireBusiness({ roles: ["owner", "manager"], feature: "csv" });
  if (!g.ok) return g.res;
  const { db, business } = g.ctx;
  const m = business.merchant;
  const days = Math.min(366, Math.max(1, Number(new URL(req.url).searchParams.get("days") ?? "90") || 90));
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [{ data }, names] = await Promise.all([
    db
      .from("charges")
      .select("created_at, paid_at, status, kind, ticket_ref, customer_name, description, amount, tip_amount, tip_only, currency, paid_method, payer_name, paid_reference, platform_fee, created_by, mode, code")
      .eq("merchant_id", m.id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20000),
    memberNames(db, m.id),
  ]);
  const header = ["created_at", "paid_at", "status", "type", "ticket", "customer", "description", "amount", "tip", "total", "currency", "method", "payer", "reference", "avec_fee", "employee", "mode", "code"];
  const rows = (data ?? []).map((c) => {
    const tip = c.tip_only ? Number(c.amount) : Number(c.tip_amount ?? 0);
    const amount = c.tip_only ? 0 : Number(c.amount);
    return [
      c.created_at, c.paid_at, c.status, c.tip_only ? "tip" : c.kind, c.ticket_ref, c.customer_name, c.description,
      amount.toFixed(2), tip.toFixed(2), (amount + tip).toFixed(2), c.currency, c.paid_method, c.payer_name, c.paid_reference,
      Number(c.platform_fee ?? 0).toFixed(2), c.created_by ? (names.get(c.created_by) ?? "") : "", c.mode, c.code,
    ].map(csv).join(",");
  });
  const body = [header.join(","), ...rows].join("\n");
  const file = `avec-${m.business_name.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${file}"`, "Cache-Control": "no-store" } });
}
