import { HAPPY_PATH, STATUS_LABELS, type TransferStatus } from "@/lib/status";
import { fmtDate } from "@/lib/format";

export interface TimelineEvent {
  status: TransferStatus;
  created_at: string;
  source: string;
}

export function StatusTimeline({ status, events }: { status: TransferStatus; events: TimelineEvent[] }) {
  const reachedAt = new Map<TransferStatus, string>();
  for (const e of events) if (!reachedAt.has(e.status)) reachedAt.set(e.status, e.created_at);
  const failed = status === "failed";
  const steps: TransferStatus[] = failed ? [...HAPPY_PATH.filter((s) => reachedAt.has(s)), "failed"] : HAPPY_PATH;

  return (
    <ol className="space-y-3">
      {steps.map((s) => {
        const at = reachedAt.get(s);
        const done = Boolean(at) || s === status;
        const isFail = s === "failed";
        return (
          <li key={s} className="flex items-start gap-3">
            <span
              className={`mt-1 h-3 w-3 flex-none rounded-full ${
                isFail ? "bg-red-500" : done ? "bg-emerald-500" : "border-2 border-slate-300 bg-white"
              }`}
            />
            <div className="min-w-0">
              <p className={`text-sm font-medium ${done ? "text-slate-900" : "text-slate-400"}`}>{STATUS_LABELS[s]}</p>
              {at && <p className="text-xs text-slate-500">{fmtDate(at)}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
