/**
 * Sales numbers for the dashboard and the AI report. Computed in code from
 * paid charges, so the AI only explains numbers; it never invents them.
 */
import { addMoney } from "@/lib/cobros/tip";

export interface StatCharge {
  amount: number | string;
  tip_amount: number | string | null;
  tip_only: boolean;
  status: string;
  paid_method: string | null;
  paid_at: string | null;
  created_at: string;
  created_by: string | null;
  kind: string;
  platform_fee?: number | string | null;
}

export interface Totals {
  total: number;
  count: number;
  tips: number;
  /** Average sale, tips excluded. */
  avg: number;
}

export interface Stats {
  today: Totals;
  week: Totals;
  prevWeek: Totals;
  month: Totals;
  daily: { date: string; total: number; count: number }[];
  methods: { method: string; total: number; count: number }[];
  members: { userId: string | null; total: number; tips: number; count: number; avg: number }[];
  busiestHours: { hour: number; count: number }[];
  cardFees: number;
}

const TZ = process.env.NEXT_PUBLIC_AVEC_TIMEZONE ?? "America/New_York";
const dayKey = (d: Date, tz = TZ) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const hourOf = (d: Date, tz = TZ) => Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(d));

function sale(c: StatCharge): { gross: number; tip: number; base: number } {
  const tip = c.tip_only ? Number(c.amount) : Number(c.tip_amount ?? 0);
  const gross = addMoney(c.amount, c.tip_only ? 0 : (c.tip_amount ?? 0));
  return { gross, tip, base: addMoney(gross, -tip) };
}

function totals(list: StatCharge[]): Totals {
  let total = 0;
  let tips = 0;
  let base = 0;
  let sales = 0;
  for (const c of list) {
    const s = sale(c);
    total = addMoney(total, s.gross);
    tips = addMoney(tips, s.tip);
    if (!c.tip_only) {
      base = addMoney(base, s.base);
      sales++;
    }
  }
  return { total, count: list.length, tips, avg: sales ? Math.round((base / sales) * 100) / 100 : 0 };
}

export function computeStats(charges: StatCharge[], now = new Date(), days = 14, tz = TZ): Stats {
  const paid = charges.filter((c) => c.status === "paid" && c.paid_at);
  const at = (c: StatCharge) => new Date(c.paid_at!);
  const today = dayKey(now, tz);
  const ms = now.getTime();
  const within = (c: StatCharge, from: number, to = ms + 1) => at(c).getTime() >= from && at(c).getTime() < to;

  const daily = Array.from({ length: days }, (_, i) => {
    const d = new Date(ms - (days - 1 - i) * 86_400_000);
    return { date: dayKey(d, tz), total: 0, count: 0 };
  });
  const byDay = new Map(daily.map((d) => [d.date, d]));
  const methods = new Map<string, { method: string; total: number; count: number }>();
  const members = new Map<string, { userId: string | null; list: StatCharge[] }>();
  const hours = new Map<number, number>();
  let cardFees = 0;

  for (const c of paid) {
    const s = sale(c);
    const d = byDay.get(dayKey(at(c), tz));
    if (d) {
      d.total = addMoney(d.total, s.gross);
      d.count++;
    }
    if (within(c, ms - 30 * 86_400_000)) {
      const key = c.paid_method ?? "other";
      const mrow = methods.get(key) ?? { method: key, total: 0, count: 0 };
      mrow.total = addMoney(mrow.total, s.gross);
      mrow.count++;
      methods.set(key, mrow);
      const who = c.created_by ?? "";
      const row = members.get(who) ?? { userId: c.created_by, list: [] };
      row.list.push(c);
      members.set(who, row);
      const h = hourOf(at(c), tz);
      hours.set(h, (hours.get(h) ?? 0) + 1);
      cardFees = addMoney(cardFees, c.platform_fee ?? 0);
    }
  }

  return {
    today: totals(paid.filter((c) => dayKey(at(c), tz) === today)),
    week: totals(paid.filter((c) => within(c, ms - 7 * 86_400_000))),
    prevWeek: totals(paid.filter((c) => within(c, ms - 14 * 86_400_000, ms - 7 * 86_400_000))),
    month: totals(paid.filter((c) => within(c, ms - 30 * 86_400_000))),
    daily,
    methods: [...methods.values()].sort((a, b) => b.total - a.total),
    members: [...members.values()]
      .map((r) => ({ userId: r.userId, ...totals(r.list) }))
      .sort((a, b) => b.total - a.total),
    busiestHours: [...hours.entries()].map(([hour, count]) => ({ hour, count })).sort((a, b) => b.count - a.count).slice(0, 3),
    cardFees,
  };
}

/** Percent change, or null when there's nothing to compare against. */
export function change(now: number, before: number): number | null {
  if (!before) return null;
  return Math.round(((now - before) / before) * 100);
}
