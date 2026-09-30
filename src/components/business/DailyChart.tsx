"use client";
import { useState } from "react";
import { formatMoney } from "@/lib/cobros/parse";
import { useLang, useT } from "@/components/i18n/LangProvider";
import { localeFor } from "@/lib/i18n";

/**
 * Collected per day, one series: thin bars from a common baseline, hover
 * (or tap) shows the day's total; the peak day is labeled directly.
 */
export function DailyChart({ days, currency }: { days: { date: string; total: number; count: number }[]; currency: string }) {
  const t = useT();
  const lang = useLang();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.total));
  const peak = days.reduce((best, d, i) => (d.total > days[best].total ? i : best), 0);
  const W = 560;
  const H = 160;
  const slot = W / days.length;
  const bar = Math.max(6, slot - 6);
  const label = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(localeFor(lang), { timeZone: "UTC", ...opts });
  const shown = hover ?? peak;

  return (
    <figure className="card space-y-2">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{t({ es: "Cobrado por día (14 días)", en: "Collected per day (14 days)" })}</span>
        <span className="text-sm text-slate-600">
          {label(days[shown].date, { weekday: "short", month: "short", day: "numeric" })}: <b className="text-slate-900">{formatMoney(days[shown].total, currency)}</b>
          <span className="text-slate-500"> · {days[shown].count}</span>
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H + 22}`} className="w-full" role="img" aria-label={t({ es: "Gráfico de cobros por día", en: "Chart of payments per day" })} onMouseLeave={() => setHover(null)}>
        <line x1={0} x2={W} y1={H} y2={H} stroke="#CBD5E1" strokeWidth={1} />
        {days.map((d, i) => {
          const h = d.total > 0 ? Math.max(3, (d.total / max) * (H - 18)) : 0;
          const x = i * slot + (slot - bar) / 2;
          const active = shown === i;
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
              {/* Hit target taller and wider than the bar. */}
              <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
              {h > 0 && <path d={roundedTop(x, H - h, bar, h, 4)} fill={active ? "#1B1E25" : "#475569"} />}
              {(i === 0 || i === days.length - 1 || i % 7 === 0) && (
                <text x={i * slot + slot / 2} y={H + 16} textAnchor="middle" fontSize={11} fill="#64748B">
                  {label(d.date, { month: "numeric", day: "numeric" })}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <table className="sr-only">
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <td>{d.date}</td>
              <td>{d.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}
