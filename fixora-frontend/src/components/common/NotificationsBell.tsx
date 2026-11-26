import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  DollarSign,
  FileText,
  MessageSquare,
  Star,
} from "lucide-react";
import {
  getNotifications,
  getUnreadNotificationsCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/api";

export interface AppNotificationItem {
  id: string;
  event: string;
  title: string;
  message: string;
  targetTab?: string;
  readAt: string | null;
  createdAt?: string;
}

interface NotificationsBellProps {
  onNavigateTarget?: (targetTab: string) => void;
  variant?: "light" | "dark";
}

function normalizeNotification(raw: Record<string, unknown>): AppNotificationItem {
  const dataObj =
    raw.data && typeof raw.data === "object"
      ? (raw.data as Record<string, unknown>)
      : raw;

  const event = String(
    dataObj.event ?? raw.event ?? raw.type ?? "system"
  );
  const title = String(
    dataObj.title ?? raw.title ?? "Notificación de Fixora"
  );
  const message = String(
    dataObj.message ??
      dataObj.body ??
      raw.message ??
      raw.body ??
      ""
  );
  const targetTab =
    typeof dataObj.target_tab === "string"
      ? dataObj.target_tab
      : typeof raw.target_tab === "string"
        ? raw.target_tab
        : undefined;

  const readAt =
    typeof raw.read_at === "string"
      ? raw.read_at
      : raw.read === true
        ? "read"
        : null;

  return {
    id: String(raw.id ?? ""),
    event,
    title,
    message,
    targetTab,
    readAt,
    createdAt:
      typeof raw.created_at === "string" ? raw.created_at : undefined,
  };
}

function formatRelativeTime(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "Ahora";
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Hace ${diffHr} h`;
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

export function NotificationsBell({
  onNavigateTarget,
}: NotificationsBellProps) {
  const [open, setOpen] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [items, setItems] = useState<AppNotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await getUnreadNotificationsCount();
      const payload = res.data as {
        unread_count?: number;
        data?: { unread_count?: number };
      };
      const count = payload?.unread_count ?? payload?.data?.unread_count ?? 0;
      setUnreadCount(Number(count) || 0);
    } catch {
      // Silencioso en polling
    }
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getNotifications({
        unread: onlyUnread || undefined,
      });
      const rawList = res.data?.data ?? res.data ?? [];
      if (Array.isArray(rawList)) {
        setItems(
          rawList.map((entry: Record<string, unknown>) =>
            normalizeNotification(entry)
          )
        );
      }
    } catch {
      // Mantiene lista actual
    } finally {
      setLoading(false);
    }
  }, [onlyUnread]);

  useEffect(() => {
    void fetchUnreadCount();
    const interval = setInterval(() => {
      void fetchUnreadCount();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (open) {
      void fetchList();
      void fetchUnreadCount();
    }
  }, [open, fetchList, fetchUnreadCount]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleOutside);
    }
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const handleMarkOne = async (notif: AppNotificationItem) => {
    if (!notif.readAt) {
      try {
        await markNotificationRead(notif.id);
        setItems((prev) =>
          prev.map((it) =>
            it.id === notif.id ? { ...it, readAt: new Date().toISOString() } : it
          )
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // Continúa navegación
      }
    }

    if (notif.targetTab && onNavigateTarget) {
      onNavigateTarget(notif.targetTab);
      setOpen(false);
    }
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      setItems((prev) =>
        prev.map((it) => ({
          ...it,
          readAt: it.readAt ?? new Date().toISOString(),
        }))
      );
      setUnreadCount(0);
    } finally {
      setMarkingAll(false);
    }
  };

  const renderEventIcon = (event: string) => {
    if (event.includes("quote")) {
      return (
        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
          <DollarSign className="w-4 h-4" />
        </div>
      );
    }
    if (event.includes("message")) {
      return (
        <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0">
          <MessageSquare className="w-4 h-4" />
        </div>
      );
    }
    if (event.includes("review")) {
      return (
        <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
          <Star className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
        <FileText className="w-4 h-4" />
      </div>
    );
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Centro de notificaciones"
        className="relative inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-[#0F172A] transition-colors cursor-pointer"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-[#EF4444] text-white text-[10px] font-extrabold flex items-center justify-center shadow-xs">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-slate-200 shadow-2xl z-50 overflow-hidden">
          {/* Header del popover */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50/70">
            <div>
              <h3 className="text-sm font-extrabold text-[#0F172A]">
                Centro de Notificaciones
              </h3>
              <p className="text-[11px] text-slate-500">
                {unreadCount > 0
                  ? `Tienes ${unreadCount} sin leer`
                  : "Estás al día con tus alertas"}
              </p>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                disabled={markingAll}
                onClick={() => void handleMarkAll()}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#2563EB] hover:underline disabled:opacity-50 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Marcar leídas
              </button>
            )}
          </div>

          {/* Filtro rápido */}
          <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyUnread(false)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                !onlyUnread
                  ? "bg-[#0F172A] text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setOnlyUnread(true)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                onlyUnread
                  ? "bg-[#0F172A] text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              No leídas
            </button>
          </div>

          {/* Lista de notificaciones */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="p-6 text-center text-xs font-mono text-slate-400">
                Cargando notificaciones...
              </div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2.5">
                  <Bell className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-700">
                  {onlyUnread
                    ? "No tienes notificaciones sin leer"
                    : "Aún no tienes notificaciones"}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Aquí verás avisos de cotizaciones, mensajes y estados de servicio.
                </p>
              </div>
            ) : (
              items.map((notif) => {
                const isUnread = !notif.readAt;
                return (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => void handleMarkOne(notif)}
                    className={`w-full text-left p-3.5 flex items-start gap-3 transition-colors cursor-pointer ${
                      isUnread
                        ? "bg-blue-50/50 hover:bg-blue-50"
                        : "bg-white hover:bg-slate-50"
                    }`}
                  >
                    {renderEventIcon(notif.event)}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-xs leading-snug ${
                            isUnread
                              ? "font-extrabold text-[#0F172A]"
                              : "font-semibold text-slate-700"
                          }`}
                        >
                          {notif.title}
                        </p>
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-[#2563EB] shrink-0 mt-1" />
                        )}
                      </div>

                      {notif.message && (
                        <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">
                          {notif.message}
                        </p>
                      )}

                      <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-400">
                        <span>{formatRelativeTime(notif.createdAt)}</span>
                        {!isUnread && (
                          <span className="inline-flex items-center gap-0.5 text-slate-400">
                            <Check className="w-3 h-3" /> Leída
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationsBell;