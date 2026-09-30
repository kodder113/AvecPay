import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { accessState } from "@/lib/business/access";
import { hasFeature, isPlanId } from "@/lib/business/plans";
import { REMINDER_COLUMNS, sendTicketReminder, type ReminderCharge } from "@/lib/business/reminders";
import { runWeeklyReports } from "@/lib/ai/weekly";
import { emailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily job (Vercel Cron, see vercel.json): automatic reminders for unpaid
 * tickets at 3 and 7 days (Business plan), and on Mondays the AI weekly
 * report. Vercel sends "Authorization: Bearer $CRON_SECRET".
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = createAdminClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? new URL(req.url).origin;
  const result = { reminders: 0, reports: 0 };

  if (emailConfigured()) {
    const now = Date.now();
    const { data: tickets } = await db
      .from("charges")
      .select(`${REMINDER_COLUMNS}, created_at, merchants(business_name, plan, subscription_status, access_until, past_due_since)`)
      .eq("kind", "ticket")
      .eq("status", "pending")
      .not("customer_email", "is", null)
      .lt("reminders_sent", 2)
      .lt("created_at", new Date(now - 3 * 86_400_000).toISOString())
      .limit(500);
    for (const c of tickets ?? []) {
      const m = (Array.isArray(c.merchants) ? c.merchants[0] : c.merchants) as { business_name: string; plan: string | null; subscription_status: string; access_until: string | null; past_due_since: string | null } | null;
      if (!m || !isPlanId(m.plan) || !hasFeature(m.plan, "unpaid_tickets") || !accessState(m).ok) continue;
      const ageDays = (now - new Date(c.created_at as string).getTime()) / 86_400_000;
      const due = (c.reminders_sent === 0 && ageDays >= 3) || (c.reminders_sent === 1 && ageDays >= 7);
      if (!due) continue;
      const r = await sendTicketReminder(db, c as unknown as ReminderCharge, m.business_name, origin);
      if (r.sent) result.reminders++;
    }
  }

  // Mondays (US Eastern): the AI weekly report for Business plans.
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: process.env.NEXT_PUBLIC_AVEC_TIMEZONE ?? "America/New_York", weekday: "short" }).format(new Date());
  if (weekday === "Mon" || new URL(req.url).searchParams.get("weekly") === "1") result.reports = await runWeeklyReports(db, origin);

  return NextResponse.json(result);
}
