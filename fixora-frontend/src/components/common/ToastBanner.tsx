import { CheckCircle, AlertCircle, Info, X } from "lucide-react";
import { useNav } from "@/context/NavigationContext";

export function ToastBanner() {
  const { toasts, dismissToast } = useNav();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-96 z-50 flex flex-col gap-2.5 pointer-events-none"
    >
      {toasts.map((toast) => {
        const styles = {
          success: "bg-white border-emerald-200 text-[#0F172A]",
          error: "bg-white border-red-200 text-[#0F172A]",
          info: "bg-white border-blue-200 text-[#0F172A]",
        }[toast.type];

        const Icon =
          toast.type === "success"
            ? CheckCircle
            : toast.type === "error"
            ? AlertCircle
            : Info;

        const iconColor =
          toast.type === "success"
            ? "text-emerald-600"
            : toast.type === "error"
            ? "text-red-600"
            : "text-[#2563EB]";

        return (
          <div
            key={toast.id}
            role={toast.type === "error" ? "alert" : "status"}
            className={`pointer-events-auto rounded-2xl border shadow-lg p-4 flex items-start gap-3 transition-all ${styles}`}
          >
            <Icon size={18} className={`mt-0.5 flex-shrink-0 ${iconColor}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-snug">{toast.title}</p>
              {toast.message && (
                <p className="text-xs text-[#475569] mt-0.5 leading-relaxed">{toast.message}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Cerrar notificación"
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
