import { STATUS_LABELS, type TransferStatus } from "@/lib/status";
import { getT } from "@/lib/i18n/server";

const COLORS: Record<TransferStatus, string> = {
  created: "bg-slate-100 text-slate-700",
  awaiting_usdt: "bg-amber-100 text-amber-800",
  usdt_received: "bg-sky-100 text-sky-800",
  processing: "bg-sky-100 text-sky-800",
  payout_initiated: "bg-indigo-100 text-indigo-800",
  completed: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
};

export async function StatusBadge({ status }: { status: TransferStatus }) {
  const { t } = await getT();
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${COLORS[status]}`}>
      {t(STATUS_LABELS[status])}
    </span>
  );
}
