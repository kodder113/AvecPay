import { loadBusiness, seesAllCharges } from "@/lib/business/context";
import { listMembers, memberLabel } from "@/lib/business/members";
import { hasFeature } from "@/lib/business/plans";
import { gatePage } from "@/components/business/Gate";
import { QrLinks, type LinkView } from "@/components/business/QrLinks";

/** Permanent QRs to print: pay any amount, tips, one per tech on Team/Business. */
export default async function QrPage() {
  const ctx = await loadBusiness();
  const gate = gatePage(ctx, { access: true });
  if (gate) return gate;
  const { db, t, user } = ctx;
  const business = ctx.business!;
  const m = business.merchant;
  const manage = seesAllCharges(business.role);

  let q = db.from("pay_links").select("id, code, kind, label, member_user_id, active, created_at").eq("merchant_id", m.id).order("created_at");
  if (!manage) q = q.eq("member_user_id", user!.id);
  const [{ data: links }, members] = await Promise.all([q, listMembers(db, m.id)]);
  const names = new Map(members.filter((x) => x.user_id).map((x) => [x.user_id!, memberLabel(x)]));
  const views: LinkView[] = (links ?? []).map((l) => ({ ...l, member: l.member_user_id ? (names.get(l.member_user_id) ?? null) : null }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t({ es: "Mis QR permanentes", en: "Permanent QR codes" })}</h1>
        <p className="text-slate-600">
          {t({
            es: "Imprímelos y ponlos en el mostrador, la mesa o la camioneta. No vencen: el cliente escribe el monto y paga.",
            en: "Print them for the counter, desk or truck. They never expire: the customer types the amount and pays.",
          })}
        </p>
      </div>
      <QrLinks
        links={views}
        canManage={manage}
        members={hasFeature(m.plan, "employee_qr") && manage ? members.filter((x) => x.user_id && x.status === "active").map((x) => ({ id: x.user_id!, name: memberLabel(x) })) : []}
        starter={!hasFeature(m.plan, "employee_qr")}
      />
    </div>
  );
}
