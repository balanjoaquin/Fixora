import { SERVICE_STATUS_META } from "@/constants/fixoraData";
import type { ServiceStatus } from "@/types";

export function StatusBadge({ status }: { status: ServiceStatus | string }) {
  const meta = SERVICE_STATUS_META[status as ServiceStatus];
  const badgeClass = meta?.badge ?? "bg-slate-50 text-slate-700 border-slate-200";
  const dotClass = meta?.dot ?? "bg-slate-400";

  return (
    <span
      title={meta?.hint}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${badgeClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} aria-hidden="true" />
      {status}
    </span>
  );
}
