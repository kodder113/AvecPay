import "server-only";
import type { Db, MerchantRow } from "@/lib/business/context";
import { MERCHANT_COLUMNS } from "@/lib/business/context";
import { accessState } from "@/lib/business/access";
import { hasFeature } from "@/lib/business/plans";
import { computeStats, type StatCharge } from "@/lib/business/insights";
import { memberNames } from "@/lib/business/members";
import { methodInfo } from "@/lib/cobros/methods";
import { aiConfigured, askClaude } from "./claude";
import { emailConfigured, emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import type { Lang } from "@/lib/i18n";

const STAT_COLUMNS = "amount, tip_amount, tip_only, status, paid_method, paid_at, created_at, created_by, kind, platform_fee, ticket_ref, customer_name, expires_at";

/**
 * The numbers the AI may talk about, computed here. The model explains and
 * suggests; it never computes totals itself.
 */
export async function businessFacts(db: Db, m: MerchantRow, lang: Lang, days = 90) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [{ data }, names] = await Promise.all([
    db.from("charges").select(STAT_COLUMNS).eq("merchant_id", m.id).eq("mode", m.mode).gte("created_at", since).limit(20000),
    memberNames(db, m.id),
  ]);
  const charges = (data ?? []) as (StatCharge & { ticket_ref: string | null; customer_name: string | null; expires_at: string })[];
  const stats = computeStats(charges);
  const info = methodInfo(lang);
  const who = (id: string | null) => (id ? (names.get(id) ?? "former team member") : "business QR / unassigned");

  // Monthly totals per team member, for questions like "how much did X collect in October?".
  const monthly = new Map<string, { member: string; month: string; total: number; tips: number; sales: number }>();
  for (const c of charges.filter((x) => x.status === "paid" && x.paid_at)) {
    const month = c.paid_at!.slice(0, 7);
    const key = `${c.created_by ?? ""}|${month}`;
    const tip = c.tip_only ? Number(c.amount) : Number(c.tip_amount ?? 0);
    const gross = c.tip_only ? Number(c.amount) : Number(c.amount) + tip;
    const row = monthly.get(key) ?? { member: who(c.created_by), month, total: 0, tips: 0, sales: 0 };
    row.total = Math.round((row.total + gross) * 100) / 100;
    row.tips = Math.round((row.tips + tip) * 100) / 100;
    row.sales++;
    monthly.set(key, row);
  }
  const now = Date.now();
  const openTickets = charges
    .filter((c) => c.kind === "ticket" && (c.status === "pending" || c.status === "reported"))
    .map((c) => ({ ticket: c.ticket_ref, customer: c.customer_name, amount: Number(c.amount), days_open: Math.floor((now - new Date(c.created_at).getTime()) / 86_400_000), created_by: who(c.created_by) }))
    .sort((a, b) => b.days_open - a.days_open);

  return {
    business: m.business_name,
    currency: m.currency,
    mode: m.mode === "live" ? "real money" : "demo (play money)",
    generated_at: new Date().toISOString(),
    last_7_days: stats.week,
    previous_7_days: stats.prevWeek,
    last_30_days: stats.month,
    today: stats.today,
    daily_last_14_days: stats.daily,
    payment_methods_last_30_days: stats.methods.map((x) => ({ method: info[x.method as keyof typeof info]?.label ?? x.method, total: x.total, count: x.count })),
    team_last_30_days: stats.members.map((x) => ({ member: who(x.userId), total: x.total, tips: x.tips, sales: x.count, average_sale: x.avg })),
    team_by_month_last_90_days: [...monthly.values()].sort((a, b) => (a.month === b.month ? b.total - a.total : a.month < b.month ? 1 : -1)),
    busiest_hours_last_30_days: stats.busiestHours,
    avec_card_fees_last_30_days: stats.cardFees,
    open_tickets: { count: openTickets.length, total: Math.round(openTickets.reduce((s, x) => s + x.amount, 0) * 100) / 100, oldest_first: openTickets.slice(0, 25) },
  };
}

const SYSTEM = `You are the analyst inside Avec Pay, a QR payments app for small US service businesses and shops (HVAC, appliance repair, food, retail). You write for the business owner: busy, not technical, reading on a phone.

Rules:
- Use only the numbers in the JSON the user message gives you. Never estimate, extrapolate or invent a figure; if something isn't in the data, say so plainly.
- Money is in the business's currency; show it like $1,234.50.
- "Tips" are separate from sales; "average_sale" excludes tips.
- Be specific: name team members, days, and amounts. Skip generic advice.
- Write in the language requested by the user message.`;

export async function generateWeeklyReport(db: Db, m: MerchantRow, lang: Lang, createdBy: string | null): Promise<string> {
  const facts = await businessFacts(db, m, lang);
  const answer = await askClaude(
    SYSTEM,
    `Write this week's report for ${m.business_name} in ${lang === "es" ? "Spanish" : "English"}.

Format (plain text with short markdown headings, under 250 words):
1. One-line headline: collected in the last 7 days and the change vs the previous 7 days.
2. "Highlights": 3-5 bullets (best day, best team member, tips, payment methods, anything unusual).
3. "Money waiting": open tickets that need follow-up (oldest first), or say there are none.
4. "Try this week": 2 concrete, low-effort suggestions grounded in these numbers.

Data:
${JSON.stringify(facts)}`,
  );
  const end = new Date();
  await db.from("ai_reports").insert({
    merchant_id: m.id,
    kind: "weekly",
    answer,
    lang,
    period_start: new Date(end.getTime() - 7 * 86_400_000).toISOString(),
    period_end: end.toISOString(),
    created_by: createdBy,
  });
  return answer;
}

export async function answerQuestion(db: Db, m: MerchantRow, question: string, lang: Lang, createdBy: string): Promise<string> {
  const facts = await businessFacts(db, m, lang);
  const answer = await askClaude(
    SYSTEM,
    `Answer the owner's question in ${lang === "es" ? "Spanish" : "English"}, in at most 120 words. Lead with the direct answer (the number or name), then one line of context. If the data can't answer it, say what you can answer instead.

Question: ${question}

Data:
${JSON.stringify(facts)}`,
  );
  await db.from("ai_reports").insert({ merchant_id: m.id, kind: "question", question, answer, lang, created_by: createdBy });
  return answer;
}

/** Monday job: a report for every active Business-plan merchant that wants one, emailed to the owner. */
export async function runWeeklyReports(db: Db, origin: string): Promise<number> {
  if (!aiConfigured()) return 0;
  const { data: merchants } = await db.from("merchants").select(MERCHANT_COLUMNS).eq("plan", "business").eq("weekly_report", true).limit(500);
  let sent = 0;
  for (const m of (merchants ?? []) as MerchantRow[]) {
    if (!hasFeature(m.plan, "ai") || !accessState(m).ok) continue;
    try {
      const report = await generateWeeklyReport(db, m, "en", null);
      sent++;
      if (emailConfigured()) {
        const { data: owner } = await db.from("merchant_members").select("email").eq("merchant_id", m.id).eq("role", "owner").maybeSingle();
        if (owner?.email) {
          await sendEmail({
            to: owner.email,
            subject: `${m.business_name}: your weekly Avec report`,
            html: emailLayout(`Your week at ${m.business_name}`, `<div style="white-space:pre-wrap;line-height:1.5">${escapeHtml(report)}</div>`, { label: "Open dashboard", url: `${origin}/cobrar/panel` }),
          });
        }
      }
    } catch (e) {
      console.error("weekly report", m.id, e);
    }
  }
  return sent;
}
