import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CheckCircle,
  Clock,
  DollarSign,
  FileText,
  FilterX,
  Home,
  Lock,
  LogOut,
  Mail,
  MailCheck,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Star,
  Tag,
  Trash2,
  User,
  Wrench,
  X,
} from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { PhotoGallery } from "@/components/common/PhotoGallery";
import { PhotoUploader } from "@/components/common/PhotoUploader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/forms/Button";
import { InputField } from "@/components/forms/InputField";
import { SelectField } from "@/components/forms/SelectField";
import {
  DashboardShell,
  type DashboardNavItem,
} from "@/components/layout/DashboardShell";
import {
  ServiceReceiptModal,
  type ReceiptOrderData,
} from "@/components/modals/ServiceReceiptModal";
import { SPECIALTIES } from "@/constants/fixoraData";
import { useNav } from "@/context/NavigationContext";
import {
  cancelServiceRequest,
  changePassword,
  createServiceReview,
  deleteAccountAvatar,
  getApiErrorMessage,
  getServiceRequestMessages,
  getServiceRequests,
  getSpecialties,
  logoutUser,
  resendVerificationEmail,
  searchTechnicians,
  sendServiceRequestMessage,
  updateAccount,
  uploadAccountAvatar,
  type RequestNegotiationMessage,
} from "@/services/api";
import type { ClientTab, ServiceStatus, TechnicianSummary } from "@/types";

export interface ApiServiceReview {
  id: number;
  rating: number;
  comment?: string | null;
  photos?: string[] | null;
  technician_reply?: string | null;
  replied_at?: string | null;
  created_at?: string;
}

export interface ApiServiceRequest {
  id: number;
  status: string;
  title: string;
  description: string;
  photos?: string[] | null;
  approx_zone: string;
  address_line?: string | null;
  preferred_date: string;
  preferred_start: string;
  closing_reason?: string | null;
  available_actions?: string[];
  review?: ApiServiceReview | null;
  client?: {
    id: number;
    name: string;
    phone?: string | null;
    avatar_url?: string | null;
  };
  technician_profile?: {
    id: number;
    headline?: string;
    service_zone?: string;
    avatar_url?: string | null;
    user?: {
      id: number;
      name: string;
      phone?: string | null;
      avatar_url?: string | null;
    };
  };
  specialty?: { id: number; name: string; slug?: string };
  technician_service?: {
    id: number;
    title: string;
    reference_price?: string | number | null;
  };
  events?: Array<{ id: number; reason?: string | null }>;
}

interface SpecialtyOption {
  id: number;
  name: string;
}

export function mapBackendStatusToUi(status: string): ServiceStatus {
  switch (status) {
    case "pending":
      return "Pendiente";
    case "accepted":
      return "Aceptada";
    case "in_progress":
      return "En proceso";
    case "completed":
      return "Finalizada";
    case "cancelled":
    case "rejected":
    case "expired":
    default:
      return "Cancelada";
  }
}

export function getRawStatusLabel(status: string): string | null {
  if (status === "rejected") return "Rechazada por técnico";
  if (status === "expired") return "Expirada (48 h)";
  return null;
}

function mapApiTechnicianToSummary(
  raw: Record<string, unknown>
): TechnicianSummary {
  const userObj =
    raw.user && typeof raw.user === "object"
      ? (raw.user as Record<string, unknown>)
      : undefined;
  const specialtiesList = Array.isArray(raw.specialties)
    ? (raw.specialties as Array<{ id: number; name: string; slug?: string }>)
    : [];
  const servicesList = Array.isArray(raw.services)
    ? (
        raw.services as Array<{
          id: number;
          specialty_id?: number | null;
          title: string;
          description?: string | null;
          reference_price?: string | number | null;
        }>
      ).map((srv) => ({
        id: srv.id,
        specialty_id: srv.specialty_id ?? specialtiesList[0]?.id ?? 0,
        title: srv.title,
        description: srv.description ?? null,
        reference_price: srv.reference_price ?? null,
      }))
    : [];

  const rawExp =
    raw.years_experience ?? raw.experience_years ?? raw.experience;
  const parsedExp =
    rawExp !== undefined && rawExp !== null && Number(rawExp) > 0
      ? Number(rawExp)
      : null;

  const rawZone =
    raw.service_zone ??
    raw.service_area ??
    raw.zone ??
    raw.city ??
    raw.approx_zone ??
    "";

  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? userObj?.name ?? "Especialista"),
    headline: typeof raw.headline === "string" ? raw.headline : undefined,
    specialty:
      specialtiesList.map((s) => s.name).join(" • ") ||
      (typeof raw.headline === "string" ? raw.headline : "Servicios Técnicos"),
    specialtyId: specialtiesList[0]?.id,
    specialties: specialtiesList,
    services: servicesList,
    experienceYears: parsedExp,
    rating:
      raw.rating_avg !== undefined && raw.rating_avg !== null
        ? Number(raw.rating_avg)
        : null,
    reviewsCount:
      typeof raw.rating_count === "number"
        ? raw.rating_count
        : typeof raw.reviews_count === "number"
          ? raw.reviews_count
          : 0,
    completedCount:
      typeof raw.completed_count === "number"
        ? raw.completed_count
        : typeof raw.completed_requests_count === "number"
          ? raw.completed_requests_count
          : 0,
    city: String(rawZone).trim(),
    available: true,
    bio: String(raw.bio ?? ""),
    certifications: [],
  };
}

function ClientAvatar({
  src,
  name,
  size = "md",
}: {
  src?: string | null;
  name?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [src]);

  const dimensions =
    size === "lg"
      ? "w-20 h-20 rounded-2xl"
      : size === "sm"
        ? "w-11 h-11 rounded-xl"
        : "w-14 h-14 rounded-2xl";

  const iconSize = size === "lg" ? 32 : size === "sm" ? 20 : 26;

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name ? `Foto de perfil de ${name}` : "Foto de perfil"}
        onError={() => setImgError(true)}
        className={`${dimensions} object-cover border border-[#BFDBFE] bg-[#EFF6FF] flex-shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${dimensions} bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#2563EB] flex-shrink-0`}
    >
      <User size={iconSize} />
    </div>
  );
}

function ClientOverview({
  apiRequests,
  loadingRequests,
  onNavigateTab,
}: {
  apiRequests: ApiServiceRequest[];
  loadingRequests: boolean;
  onNavigateTab: (tab: ClientTab) => void;
}) {
  const { user, openModal, showToast } = useNav();
  const [resending, setResending] = useState(false);

  const activeCount = apiRequests.filter((r) =>
    ["pending", "accepted", "in_progress"].includes(r.status)
  ).length;
  const completedCount = apiRequests.filter(
    (r) => r.status === "completed"
  ).length;

  const stats = [
    {
      label: "Solicitudes totales",
      value: loadingRequests ? "..." : String(apiRequests.length),
      icon: FileText,
      cls: "bg-[#EFF6FF] text-[#2563EB]",
    },
    {
      label: "Servicios activos",
      value: loadingRequests ? "..." : String(activeCount),
      icon: Clock,
      cls: "bg-amber-50 text-amber-600",
    },
    {
      label: "Finalizados",
      value: loadingRequests ? "..." : String(completedCount),
      icon: CheckCircle,
      cls: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Especialidades",
      value: String(SPECIALTIES.length),
      icon: Wrench,
      cls: "bg-indigo-50 text-indigo-600",
    },
  ];

  const handleResend = async () => {
    setResending(true);
    try {
      await resendVerificationEmail();
      showToast({
        type: "success",
        title: "Correo enviado",
        message: "Revisa tu bandeja de entrada para activar tu cuenta.",
      });
    } catch (err: unknown) {
      showToast({
        type: "error",
        title: "No se pudo reenviar",
        message: getApiErrorMessage(err, "Intenta de nuevo en unos minutos."),
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="space-y-6">
      {user && !user.email_verified_at && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs sm:text-sm text-amber-950">
            <strong>Verifica tu correo electrónico:</strong> Debes confirmar{" "}
            <span className="font-mono">{user.email}</span> para poder enviar
            solicitudes de servicio.
          </div>
          <Button
            variant="outline"
            size="sm"
            loading={resending}
            onClick={handleResend}
          >
            <MailCheck size={14} />
            Reenviar enlace
          </Button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <ClientAvatar src={user?.avatar_url} name={user?.name} size="md" />
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F172A]">
              {user ? `¡Hola, ${user.name}!` : "¡Bienvenido a Fixora!"}
            </h2>
            <p className="text-sm text-[#475569] mt-0.5">
              Gestiona tus órdenes técnicas, busca especialistas verificados y
              consulta tu historial.
            </p>
          </div>
        </div>
        <Button
          variant="primary"
          onClick={() => openModal({ type: "request-service" })}
        >
          <Plus size={17} />
          Nueva Solicitud
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E2E8F0]"
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${s.cls}`}
            >
              <s.icon size={18} />
            </div>
            <div className="text-2xl font-extrabold text-[#0F172A]">
              {s.value}
            </div>
            <div className="text-xs text-[#64748B] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-[#0F172A] via-[#1E3A8A] to-[#2563EB] rounded-2xl p-6 text-white">
          <Search size={25} className="mb-3 text-blue-200" />
          <h3 className="text-lg font-bold mb-1">Explorar Especialistas</h3>
          <p className="text-blue-100 text-sm mb-5 leading-relaxed">
            Filtra por área técnica, zona y calificación para encontrar ayuda
            confiable.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onNavigateTab("search")}
          >
            Buscar Técnicos
          </Button>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] flex flex-col justify-between">
          <div>
            <FileText size={25} className="mb-3 text-[#2563EB]" />
            <h3 className="text-lg font-bold text-[#0F172A] mb-1">
              Mis Solicitudes
            </h3>
            <p className="text-[#475569] text-sm mb-5 leading-relaxed">
              Consulta el folio, estado actual y detalles de tus servicios
              programados.
            </p>
          </div>
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigateTab("requests")}
            >
              Ver Mis Solicitudes ({apiRequests.length})
            </Button>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[#0F172A]">Actividad reciente</h3>
          {apiRequests.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigateTab("requests")}
              className="text-xs font-bold text-[#2563EB] hover:underline cursor-pointer"
            >
              Ver todas →
            </button>
          )}
        </div>

        {loadingRequests ? (
          <p className="text-xs font-mono text-[#64748B] py-4">
            Cargando solicitudes...
          </p>
        ) : apiRequests.length === 0 ? (
          <EmptyState
            icon={<Clock size={24} />}
            title="Aún no tienes solicitudes registradas"
            description="Crea tu primera orden de servicio indicando la especialidad y el horario que necesitas."
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => openModal({ type: "request-service" })}
              >
                <Plus size={15} />
                Solicitar primer servicio
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-[#E2E8F0]">
            {apiRequests.slice(0, 3).map((req) => (
              <div
                key={req.id}
                className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#2563EB]">
                      FX-{String(req.id).padStart(4, "0")}
                    </span>
                    <span className="font-bold text-sm text-[#0F172A]">
                      {req.specialty?.name ?? req.title}
                    </span>
                  </div>
                  <p className="text-xs text-[#475569] mt-0.5 line-clamp-1">
                    {req.title} — {req.description}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#64748B]">
                    {req.preferred_date?.slice(0, 10)}
                  </span>
                  <StatusBadge status={mapBackendStatusToUi(req.status)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ClientSearchView() {
  const { selectedSpecialty, setSelectedSpecialty, openModal, showToast } =
    useNav();
  const [specialties, setSpecialties] = useState<SpecialtyOption[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [zone, setZone] = useState("");
  const [minRating, setMinRating] = useState("");
  const [sortBy, setSortBy] = useState<"" | "rating" | "experience">("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await getSpecialties();
        const list = res.data?.data ?? res.data ?? [];
        if (active && Array.isArray(list)) {
          setSpecialties(list);
        }
      } catch {
        // Fallback silencioso
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const fetchTechnicians = useCallback(async () => {
    setLoading(true);
    try {
      const matchedSpec = specialties.find(
        (s) =>
          s.name.toLowerCase() === selectedSpecialty.toLowerCase() ||
          String(s.id) === selectedSpecialty
      );

      const res = await searchTechnicians({
        q: query.trim() || undefined,
        specialty_id: matchedSpec?.id,
        zone: zone.trim() || undefined,
        sort: sortBy || undefined,
        per_page: 30,
      });

      const rawList = res.data?.data ?? res.data ?? [];
      const mapped = Array.isArray(rawList)
        ? rawList.map((item: Record<string, unknown>) =>
            mapApiTechnicianToSummary(item)
          )
        : [];
      setTechnicians(mapped);
    } catch (err: unknown) {
      showToast({
        type: "error",
        title: "Error al buscar técnicos",
        message: getApiErrorMessage(err, "No se pudo consultar el directorio."),
      });
    } finally {
      setLoading(false);
    }
  }, [query, selectedSpecialty, sortBy, specialties, zone, showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchTechnicians();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchTechnicians]);

  const hasFilters = Boolean(
    query.trim() || selectedSpecialty || zone.trim() || minRating || sortBy
  );

  const resetFilters = () => {
    setQuery("");
    setSelectedSpecialty("");
    setZone("");
    setMinRating("");
    setSortBy("");
  };

  const visibleTechnicians = technicians.filter((tech) => {
    if (minRating && (tech.rating ?? 0) < Number(minRating)) {
      return false;
    }
    return true;
  });

  const specialtyOptions =
    specialties.length > 0
      ? specialties.map((s) => ({ value: s.name, label: s.name }))
      : SPECIALTIES.map((s) => ({ value: s.label, label: s.label }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F172A]">
            Buscar Técnicos
          </h2>
          <p className="text-sm text-[#475569]">
            Filtra especialistas verificados por área, zona o calificación para
            solicitar un servicio.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() =>
            openModal({
              type: "request-service",
              defaultSpecialty: selectedSpecialty,
            })
          }
        >
          <Plus size={15} />
          Solicitar Servicio Directo
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative sm:col-span-2">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por servicio, palabra clave o especialidad..."
              aria-label="Buscar por servicio, palabra clave o especialidad"
              className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl border-2 border-[#E2E8F0] focus:border-[#2563EB] text-sm focus:outline-none focus:ring-4 focus:ring-[#2563EB]/10 transition-all"
            />
          </div>

          <SelectField
            value={selectedSpecialty}
            onChange={setSelectedSpecialty}
            options={specialtyOptions}
            placeholder="Todas las especialidades"
          />

          <SelectField
            value={minRating}
            onChange={setMinRating}
            options={[
              { value: "4.5", label: "4.5+ estrellas" },
              { value: "4", label: "4.0+ estrellas" },
              { value: "3", label: "3.0+ estrellas" },
            ]}
            placeholder="Cualquier calificación"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              placeholder="Filtrar por colonia o zona..."
              className="px-3 py-1.5 rounded-xl border border-[#CBD5E1] text-xs sm:text-sm focus:border-[#2563EB] focus:outline-none"
            />
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "" | "rating" | "experience")
              }
              className="px-3 py-1.5 rounded-xl border border-[#CBD5E1] text-xs sm:text-sm bg-white focus:border-[#2563EB] focus:outline-none"
            >
              <option value="">Orden predeterminado</option>
              <option value="rating">Mejor calificación</option>
              <option value="experience">Mayor experiencia</option>
            </select>
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2563EB] hover:underline cursor-pointer"
            >
              <FilterX size={14} />
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Technicians List */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 text-center font-mono text-xs text-[#64748B]">
          Consultando especialistas disponibles...
        </div>
      ) : visibleTechnicians.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E2E8F0]">
          <EmptyState
            icon={<Wrench size={25} />}
            title={
              hasFilters
                ? "No encontramos técnicos con ese criterio"
                : "Aún no hay técnicos visibles disponibles"
            }
            description={
              hasFilters
                ? "Intenta con otro término de búsqueda o restablece los filtros activos."
                : "Cuando los técnicos completen su verificación y horarios aparecerán listados aquí."
            }
            action={
              hasFilters ? (
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  Restablecer filtros
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() =>
                    openModal({
                      type: "request-service",
                      defaultSpecialty: selectedSpecialty,
                    })
                  }
                >
                  <Plus size={15} />
                  Solicitar Servicio
                </Button>
              )
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleTechnicians.map((tech) => (
            <div
              key={tech.id}
              className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="h-1.5 bg-gradient-to-r from-[#2563EB] to-[#3B82F6]" />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] flex items-center justify-center text-[#2563EB]">
                      <Wrench size={22} />
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border text-emerald-700 bg-emerald-50 border-emerald-200">
                      <ShieldCheck size={12} />
                      Verificado
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-[#0F172A]">
                    {tech.headline || tech.specialty}
                  </h3>
                  <p className="text-xs font-semibold text-[#334155] mt-0.5">
                    {tech.name}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B] mt-2 mb-2">
                    <span className="inline-flex items-center gap-1 text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md">
                      <Star
                        size={12}
                        className="fill-amber-400 text-amber-400"
                      />
                      {tech.reviewsCount > 0 && tech.rating !== null
                        ? `${tech.rating.toFixed(1)} (${tech.reviewsCount})`
                        : "Nuevo"}
                    </span>
                    {tech.experienceYears !== null && (
                      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded-md">
                        {tech.experienceYears} años exp.
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#2563EB] font-medium mb-2">
                    {tech.specialty}
                    {tech.city ? ` • ${tech.city}` : ""}
                  </p>

                  {tech.services && tech.services.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md mb-2">
                      <Tag size={11} className="text-[#2563EB]" />
                      {tech.services.length}{" "}
                      {tech.services.length === 1
                        ? "tarifa publicada"
                        : "tarifas publicadas"}
                    </span>
                  )}

                  <p className="text-xs text-[#475569] leading-relaxed line-clamp-3">
                    {tech.bio}
                  </p>
                </div>
              </div>

              <div className="px-5 pb-5 pt-2 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() =>
                    openModal({ type: "technician-detail", technician: tech })
                  }
                >
                  Ver perfil
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  onClick={() =>
                    openModal({ type: "request-service", technician: tech })
                  }
                >
                  Solicitar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ClientRequestsView({
  apiRequests,
  loadingRequests,
  onRefresh,
}: {
  apiRequests: ApiServiceRequest[];
  loadingRequests: boolean;
  onRefresh: () => Promise<void>;
}) {
  const { user, openModal, showToast } = useNav();
  const [statusFilter, setStatusFilter] = useState<string>("Todas");
  const [confirmCancelId, setConfirmCancelId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const [receiptOrder, setReceiptOrder] = useState<ReceiptOrderData | null>(
    null
  );

  const [chatRequest, setChatRequest] = useState<ApiServiceRequest | null>(
    null
  );
  const [chatMessages, setChatMessages] = useState<RequestNegotiationMessage[]>(
    []
  );
  const [loadingChat, setLoadingChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);

  const [reviewingReq, setReviewingReq] = useState<ApiServiceRequest | null>(
    null
  );
  const [ratingValue, setRatingValue] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [reviewComment, setReviewComment] = useState<string>("");
  const [reviewPhotos, setReviewPhotos] = useState<File[]>([]);
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);

  const statuses = [
    "Todas",
    "Pendiente",
    "Aceptada",
    "En proceso",
    "Finalizada",
    "Cancelada",
  ];

  const visibleRequests =
    statusFilter === "Todas"
      ? apiRequests
      : apiRequests.filter(
          (r) => mapBackendStatusToUi(r.status) === statusFilter
        );

  const openChatModal = async (req: ApiServiceRequest) => {
    setChatRequest(req);
    setChatInput("");
    setLoadingChat(true);
    try {
      const res = await getServiceRequestMessages(req.id);
      const list = res.data?.data ?? [];
      setChatMessages(Array.isArray(list) ? list : []);
    } catch {
      setChatMessages([]);
    } finally {
      setLoadingChat(false);
    }
  };

  const handleSendClientMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatRequest || !chatInput.trim()) return;

    setSendingChat(true);
    try {
      const res = await sendServiceRequestMessage(chatRequest.id, {
        message: chatInput.trim(),
      });
      const created = res.data?.data;
      if (created) {
        setChatMessages((prev) => [...prev, created]);
      }
      setChatInput("");
      await onRefresh();
    } catch (err: unknown) {
      showToast({
        type: "error",
        title: "No se pudo enviar el mensaje",
        message: getApiErrorMessage(err, "Intenta de nuevo."),
      });
    } finally {
      setSendingChat(false);
    }
  };

  const handleConfirmCancel = async (req: ApiServiceRequest) => {
    const requiresReason =
      req.status === "accepted" || req.status === "in_progress";
    if (requiresReason && !cancelReason.trim()) {
      showToast({
        type: "error",
        title: "Motivo obligatorio",
        message: "Indica el motivo de cancelación para esta orden confirmada.",
      });
      return;
    }

    setCancelling(true);
    try {
      await cancelServiceRequest(req.id, cancelReason.trim() || undefined);
      setConfirmCancelId(null);
      setCancelReason("");
      await onRefresh();
      showToast({
        type: "info",
        title: "Solicitud cancelada",
        message: "El estado de la orden ha sido actualizado.",
      });
    } catch (err: unknown) {
      showToast({
        type: "error",
        title: "No se pudo cancelar",
        message: getApiErrorMessage(err, "La orden ya no admite cancelación."),
      });
    } finally {
      setCancelling(false);
    }
  };

  const handleOpenReview = (req: ApiServiceRequest) => {
    setReviewingReq(req);
    setRatingValue(5);
    setHoverRating(0);
    setReviewComment("");
    setReviewPhotos([]);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingReq) return;

    setSubmittingReview(true);
    try {
      await createServiceReview(reviewingReq.id, {
        rating: ratingValue,
        comment: reviewComment.trim() || undefined,
        photos: reviewPhotos,
      });
      setReviewingReq(null);
      setReviewComment("");
      setReviewPhotos([]);
      await onRefresh();
      showToast({
        type: "success",
        title: "Reseña publicada",
        message:
          reviewPhotos.length > 0
            ? `Tu calificación se publicó con ${reviewPhotos.length} foto(s) adjunta(s).`
            : "Tu calificación ayuda a otros clientes de Fixora.",
      });
    } catch (err: unknown) {
      showToast({
        type: "error",
        title: "No se pudo enviar la reseña",
        message: getApiErrorMessage(err, "Intenta de nuevo en unos momentos."),
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F172A]">
            Mis Solicitudes
          </h2>
          <p className="text-sm text-[#475569]">
            Da seguimiento ordenado a tus servicios, cotizaciones y trabajos
            finalizados.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            loading={loadingRequests}
            onClick={() => void onRefresh()}
          >
            <RefreshCw size={14} />
            Actualizar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => openModal({ type: "request-service" })}
          >
            <Plus size={15} />
            Nueva Solicitud
          </Button>
        </div>
      </div>

      {/* Status Filter Pills */}
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        role="tablist"
        aria-label="Filtrar solicitudes por estado"
      >
        {statuses.map((st) => (
          <button
            key={st}
            type="button"
            role="tab"
            aria-selected={statusFilter === st}
            onClick={() => setStatusFilter(st)}
            className={`flex-shrink-0 px-4 min-h-[40px] rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              statusFilter === st
                ? "bg-[#2563EB] text-white shadow-xs"
                : "bg-white text-[#475569] border border-[#E2E8F0] hover:bg-slate-50"
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {loadingRequests ? (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 text-center font-mono text-xs text-[#64748B]">
          Cargando tus órdenes...
        </div>
      ) : visibleRequests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E2E8F0]">
          <EmptyState
            icon={<FileText size={25} />}
            title={
              statusFilter === "Todas"
                ? "No tienes solicitudes registradas"
                : `Sin solicitudes en estado "${statusFilter}"`
            }
            description="Crea una solicitud técnica seleccionando especialidad, horario y dirección."
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => openModal({ type: "request-service" })}
              >
                <Plus size={15} />
                Crear Solicitud
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visibleRequests.map((req) => {
            const uiStatus = mapBackendStatusToUi(req.status);
            const rawDetail = getRawStatusLabel(req.status);
            const canCancel =
              req.available_actions?.includes("cancel") ??
              ["pending", "accepted", "in_progress"].includes(req.status);
            const canReview = req.status === "completed" && !req.review;
            const techName =
              req.technician_profile?.user?.name ?? "Especialista asignado";
            const techPhone = req.technician_profile?.user?.phone;
            const messagesCount = Array.isArray(req.events)
              ? req.events.filter((e) => e.reason && e.reason.trim() !== "")
                  .length
              : 0;

            return (
              <div
                key={req.id}
                className="bg-white rounded-2xl border border-[#E2E8F0] p-5 flex flex-col justify-between gap-4 hover:border-slate-300 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-[#EFF6FF] text-[#2563EB]">
                        FX-{String(req.id).padStart(4, "0")}
                      </span>
                      <span className="text-xs font-semibold text-[#64748B]">
                        {req.specialty?.name ?? "Servicio Técnico"}
                      </span>
                    </div>
                    <StatusBadge status={uiStatus} />
                  </div>

                  <div>
                    <h3 className="font-bold text-base text-[#0F172A]">
                      {req.title}
                    </h3>
                    <p className="text-xs text-[#475569] mt-1 line-clamp-2 leading-relaxed">
                      {req.description}
                    </p>
                  </div>

                  {rawDetail && (
                    <span className="inline-block text-[11px] font-mono px-2.5 py-0.5 rounded bg-slate-100 text-slate-700">
                      {rawDetail}
                    </span>
                  )}

                  {req.technician_service && (
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <Tag size={11} />
                      {req.technician_service.title}
                      {req.technician_service.reference_price !== null &&
                        req.technician_service.reference_price !== undefined &&
                        ` • $${Number(req.technician_service.reference_price).toFixed(0)} MXN`}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 rounded-xl bg-slate-50/80 border border-slate-100 p-3 text-xs text-[#475569]">
                    <span className="inline-flex items-center gap-1.5 truncate">
                      <User size={13} className="text-slate-400 shrink-0" />
                      <span className="truncate">{techName}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock size={13} className="text-slate-400 shrink-0" />
                      {req.preferred_date?.slice(0, 10)} •{" "}
                      {req.preferred_start?.slice(0, 5)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 sm:col-span-2 truncate">
                      <MapPin size={13} className="text-slate-400 shrink-0" />
                      <span className="truncate">
                        {req.address_line || req.approx_zone}
                      </span>
                    </span>
                    {techPhone && (
                      <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold sm:col-span-2">
                        <Phone size={13} className="shrink-0" />
                        {techPhone}
                      </span>
                    )}
                  </div>

                  <PhotoGallery photos={req.photos} title="Fotos adjuntas" />

                  {req.closing_reason && (
                    <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                      Motivo: {req.closing_reason}
                    </p>
                  )}

                  {req.review && (
                    <div className="rounded-xl bg-amber-50/70 border border-amber-200/80 p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-900">
                          Tu calificación
                        </span>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              size={13}
                              className={
                                star <= req.review!.rating
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-slate-300"
                              }
                            />
                          ))}
                        </div>
                      </div>
                      {req.review.comment && (
                        <p className="text-xs text-slate-700 line-clamp-2">
                          "{req.review.comment}"
                        </p>
                      )}

                      <PhotoGallery
                        photos={req.review.photos}
                        title="Fotos del resultado"
                      />

                      {req.review.technician_reply && (
                        <div className="mt-1 pl-2.5 border-l-2 border-[#2563EB] text-[11px] text-slate-600">
                          <span className="font-bold text-[#0F172A]">
                            Respuesta del técnico:
                          </span>{" "}
                          {req.review.technician_reply}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Pie de tarjeta */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void openChatModal(req)}
                  >
                    <MessageSquare size={14} className="text-[#2563EB]" />
                    Dialogar
                    {messagesCount > 0 && (
                      <span className="ml-1 rounded-full bg-[#2563EB] px-1.5 py-0.2 text-[10px] font-bold text-white">
                        {messagesCount}
                      </span>
                    )}
                  </Button>

                  {req.status === "completed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setReceiptOrder({
                          ...req,
                          client: req.client ?? {
                            name: user?.name,
                            phone: user?.phone,
                          },
                        })
                      }
                    >
                      <FileText size={14} className="text-[#0F172A]" />
                      Comprobante
                    </Button>
                  )}

                  {canReview && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleOpenReview(req)}
                    >
                      <Star size={14} className="fill-white" />
                      Calificar
                    </Button>
                  )}

                  {canCancel && confirmCancelId !== req.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 ml-auto"
                      onClick={() => {
                        setConfirmCancelId(req.id);
                        setCancelReason("");
                      }}
                    >
                      Cancelar
                    </Button>
                  )}

                  {confirmCancelId === req.id && (
                    <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-red-50 border border-red-200 p-2.5 rounded-xl mt-1">
                      <input
                        type="text"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder={
                          req.status === "pending"
                            ? "Motivo (opcional)"
                            : "Motivo obligatorio..."
                        }
                        className="flex-1 px-2.5 py-1.5 rounded-lg border border-red-300 bg-white text-xs text-[#0F172A] focus:outline-none"
                      />
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="danger"
                          size="sm"
                          loading={cancelling}
                          onClick={() => void handleConfirmCancel(req)}
                        >
                          Confirmar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmCancelId(null)}
                        >
                          No
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ServiceReceiptModal
        order={receiptOrder}
        onClose={() => setReceiptOrder(null)}
      />

      {/* Modal de Diálogo y Cotización */}
      {chatRequest && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          onClick={() => setChatRequest(null)}
        >
          <div
            className="w-full max-w-xl bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 sm:p-6 bg-[#0F172A] text-white flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[11px] font-bold text-blue-300">
                  <MessageSquare className="w-3 h-3" />
                  Diálogo y Cotización • FX-
                  {String(chatRequest.id).padStart(4, "0")}
                </span>
                <h3 className="mt-1.5 text-lg font-extrabold">
                  {chatRequest.title}
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Especialista:{" "}
                  {chatRequest.technician_profile?.user?.name ??
                    "Técnico asignado"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setChatRequest(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3 min-h-[220px] max-h-[340px]">
              {loadingChat ? (
                <p className="text-xs text-slate-500 text-center py-8">
                  Cargando conversación...
                </p>
              ) : chatMessages.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm font-bold text-slate-700">
                    Sin mensajes aún
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Escribe al especialista si deseas aclarar detalles o esperar
                    su cotización propuesta antes de que acepte el servicio.
                  </p>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isMe = msg.actor_role === "client";
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        isMe ? "items-end" : "items-start"
                      }`}
                    >
                      <span className="text-[11px] font-semibold text-slate-400 mb-1 px-1">
                        {isMe ? "Tú" : `${msg.actor_name} (Técnico)`}
                      </span>
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm ${
                          isMe
                            ? "bg-[#2563EB] text-white"
                            : "bg-slate-100 text-slate-800 border border-slate-200"
                        }`}
                      >
                        {msg.proposed_price !== null &&
                          msg.proposed_price !== undefined && (
                            <div
                              className={`mb-1.5 inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-extrabold ${
                                isMe
                                  ? "bg-white/20 text-white"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              Cotización propuesta: $
                              {Number(msg.proposed_price).toFixed(2)} MXN
                            </div>
                          )}
                        <p className="leading-relaxed">{msg.message}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form
              onSubmit={handleSendClientMessage}
              className="p-4 bg-slate-50 border-t border-slate-200 flex gap-2"
            >
              <input
                type="text"
                required
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Escribe tu respuesta o detalles adicionales para el técnico..."
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:border-[#2563EB] focus:outline-none"
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={sendingChat}
              >
                <Send size={14} />
                Enviar
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Modal para calificar servicio finalizado */}
      {reviewingReq && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
          onClick={() => setReviewingReq(null)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl p-6 my-8 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[#2563EB] bg-[#EFF6FF] px-2.5 py-1 rounded-full mb-1.5">
                  <Star size={12} className="fill-[#2563EB]" />
                  Calificar Servicio
                </span>
                <h3 className="text-lg font-extrabold text-[#0F172A]">
                  {reviewingReq.title}
                </h3>
                <p className="text-xs text-[#64748B]">
                  Técnico:{" "}
                  {reviewingReq.technician_profile?.user?.name ??
                    "Especialista Fixora"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewingReq(null)}
                className="p-2 rounded-xl text-[#64748B] hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitReview} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-2">
                  ¿Cómo calificas la atención y calidad del trabajo?
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = (hoverRating || ratingValue) >= star;
                    return (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setRatingValue(star)}
                        className="p-1.5 rounded-xl hover:bg-amber-50 transition-colors cursor-pointer"
                      >
                        <Star
                          size={28}
                          className={
                            active
                              ? "fill-amber-400 text-amber-400"
                              : "text-slate-300"
                          }
                        />
                      </button>
                    );
                  })}
                  <span className="ml-2 text-sm font-extrabold text-[#0F172A]">
                    {ratingValue} / 5
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                  Comentario sobre el servicio (opcional)
                </label>
                <textarea
                  rows={3}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Cuéntanos si fue puntual, limpio y resolvió el problema..."
                  className="w-full rounded-2xl border border-[#CBD5E1] px-3.5 py-2.5 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <PhotoUploader
                  label="Fotos del trabajo terminado (opcional)"
                  helperText="Opcional • JPG, PNG o WEBP (máx. 3 fotos de 4 MB)"
                  files={reviewPhotos}
                  onChange={setReviewPhotos}
                  maxFiles={3}
                  onError={(msg) =>
                    showToast({
                      type: "error",
                      title: "Imagen no válida",
                      message: msg,
                    })
                  }
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setReviewingReq(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={submittingReview}
                >
                  Publicar calificación
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ClientProfileView({ onLogout }: { onLogout: () => Promise<void> }) {
  const { user, setUser, showToast } = useNav();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState({
    nombre: user?.name ?? "",
    correo: user?.email ?? "",
    telefono: user?.phone ?? "",
  });
  const [passwords, setPasswords] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [saving, setSaving] = useState(false);
  const [updatingPwd, setUpdatingPwd] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deletingAvatar, setDeletingAvatar] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        nombre: user.name ?? "",
        correo: user.email ?? "",
        telefono: user.phone ?? "",
      });
    }
  }, [user]);

  const handleAvatarSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      showToast({
        type: "error",
        title: "Formato no compatible",
        message: "Selecciona una imagen en formato JPG, PNG o WEBP.",
      });
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      showToast({
        type: "error",
        title: "Archivo muy pesado",
        message: "La foto de perfil debe pesar máximo 4 MB.",
      });
      return;
    }

    setUploadingAvatar(true);
    try {
      const res = await uploadAccountAvatar(file);
      const updated = res.data?.user ?? res.data?.data ?? res.data;
      if (user) {
        setUser({
          ...user,
          avatar_url: updated?.avatar_url ?? user.avatar_url ?? null,
        });
      }
      showToast({
        type: "success",
        title: "Foto actualizada",
        message: "Tu foto de perfil se guardó correctamente.",
      });
    } catch (err: unknown) {
      showToast({
        type: "error",
        title: "No se pudo subir la foto",
        message: getApiErrorMessage(err, "Intenta con otra imagen."),
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user?.avatar_url) return;
    setDeletingAvatar(true);
    try {
      await deleteAccountAvatar();
      setUser({
        ...user,
        avatar_url: null,
      });
      showToast({
        type: "info",
        title: "Foto eliminada",
        message: "Se restableció tu avatar predeterminado.",
      });
    } catch (err: unknown) {
      showToast({
        type: "error",
        title: "No se pudo eliminar la foto",
        message: getApiErrorMessage(err, "Intenta de nuevo en unos momentos."),
      });
    } finally {
      setDeletingAvatar(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await updateAccount({
        name: form.nombre.trim(),
        phone: form.telefono.trim(),
      });
      const updated = res.data?.user ?? res.data?.data ?? res.data;
      if (user && updated) {
        setUser({
          ...user,
          name: updated.name ?? form.nombre.trim(),
          phone: updated.phone ?? form.telefono.trim(),
          avatar_url:
            updated.avatar_url !== undefined
              ? updated.avatar_url
              : user.avatar_url,
        });
      }
      showToast({
        type: "success",
        title: "Perfil actualizado",
        message: "Tus datos de contacto se guardaron correctamente.",
      });
    } catch (err: unknown) {
      showToast({
        type: "error",
        title: "No se pudo actualizar",
        message: getApiErrorMessage(err, "Verifica los datos ingresados."),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwords.current || passwords.next.length < 8) {
      showToast({
        type: "error",
        title: "Verifica tu contraseña",
        message:
          "Ingresa tu contraseña actual y una nueva de al menos 8 caracteres.",
      });
      return;
    }
    if (passwords.next !== passwords.confirm) {
      showToast({
        type: "error",
        title: "Las contraseñas no coinciden",
        message: "Confirma exactamente la nueva contraseña.",
      });
      return;
    }

    setUpdatingPwd(true);
    try {
      await changePassword({
        current_password: passwords.current,
        password: passwords.next,
        password_confirmation: passwords.confirm,
      });
      setPasswords({ current: "", next: "", confirm: "" });
      showToast({
        type: "success",
        title: "Contraseña actualizada",
        message: "Tu clave de acceso fue modificada.",
      });
    } catch (err: unknown) {
      showToast({
        type: "error",
        title: "Error al cambiar contraseña",
        message: getApiErrorMessage(err, "La contraseña actual es incorrecta."),
      });
    } finally {
      setUpdatingPwd(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F172A]">
          Mi Perfil
        </h2>
        <p className="text-sm text-[#475569]">
          Administra tu foto de perfil, información personal y seguridad de
          acceso.
        </p>
      </div>

      <form
        onSubmit={handleSaveProfile}
        className="bg-white rounded-2xl border border-[#E2E8F0] p-6 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-4">
            <ClientAvatar src={user?.avatar_url} name={user?.name} size="lg" />
            <div>
              <div className="font-bold text-base text-[#0F172A]">
                {user?.name ?? "Cliente Fixora"}
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">
                {user?.email_verified_at
                  ? "Cuenta con correo verificado ✓"
                  : "Correo pendiente de verificación"}
              </p>
              <p className="text-[11px] text-[#94A3B8] mt-1">
                JPG, PNG o WEBP • Máx. 4 MB
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => void handleAvatarSelected(e)}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={uploadingAvatar}
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera size={14} />
              {user?.avatar_url ? "Cambiar foto" : "Subir foto"}
            </Button>

            {user?.avatar_url && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                loading={deletingAvatar}
                onClick={() => void handleRemoveAvatar()}
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 size={14} />
                Eliminar
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField
            label="Nombre completo"
            value={form.nombre}
            onChange={(v) => setForm((f) => ({ ...f, nombre: v }))}
            placeholder="Tu nombre completo"
            icon={<User size={15} />}
          />
          <InputField
            label="Correo electrónico"
            type="email"
            value={form.correo}
            onChange={() => {}}
            disabled
            placeholder="correo@ejemplo.com"
            icon={<Mail size={15} />}
          />
          <InputField
            label="Teléfono de contacto"
            type="tel"
            value={form.telefono}
            onChange={(v) => setForm((f) => ({ ...f, telefono: v }))}
            placeholder="10 dígitos"
            icon={<Phone size={15} />}
          />
        </div>

        <div className="border-t border-[#E2E8F0] pt-4 flex justify-end">
          <Button type="submit" variant="primary" loading={saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </form>

      <form
        onSubmit={handleUpdatePassword}
        className="bg-white rounded-2xl border border-[#E2E8F0] p-6 space-y-4"
      >
        <h3 className="font-bold text-[#0F172A]">Seguridad de la cuenta</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <InputField
            label="Contraseña actual"
            type="password"
            value={passwords.current}
            onChange={(v) => setPasswords((p) => ({ ...p, current: v }))}
            placeholder="••••••••"
            icon={<Lock size={15} />}
          />
          <InputField
            label="Nueva contraseña"
            type="password"
            value={passwords.next}
            onChange={(v) => setPasswords((p) => ({ ...p, next: v }))}
            placeholder="Mínimo 8 caracteres"
            icon={<Lock size={15} />}
          />
          <InputField
            label="Confirmar nueva"
            type="password"
            value={passwords.confirm}
            onChange={(v) => setPasswords((p) => ({ ...p, confirm: v }))}
            placeholder="Repite contraseña"
            icon={<Lock size={15} />}
          />
        </div>
        <div className="flex justify-end pt-2">
          <Button type="submit" variant="outline" loading={updatingPwd}>
            Actualizar contraseña
          </Button>
        </div>
      </form>

      {/* Cerrar sesión dentro de Mi Perfil */}
      <div className="bg-white rounded-2xl border border-red-200/80 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-[#0F172A]">
            Sesión en este dispositivo
          </h3>
          <p className="text-xs text-[#64748B] mt-0.5">
            Cierra tu sesión de forma segura al terminar de usar Fixora.
          </p>
        </div>
        <Button
          type="button"
          variant="danger"
          size="sm"
          onClick={() => void onLogout()}
        >
          <LogOut size={15} />
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}

export function ClientSettingsView() {
  const { showToast } = useNav();
  const [prefs, setPrefs] = useState({
    emailAlerts: true,
    statusUpdates: true,
    twoFactorHint: false,
  });

  const togglePref = (key: keyof typeof prefs) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
    showToast({
      type: "info",
      title: "Preferencia actualizada",
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F172A]">
          Configuración
        </h2>
        <p className="text-sm text-[#475569]">
          Controla cómo recibes avisos sobre tus solicitudes y cuenta.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-[#E2E8F0] divide-y divide-[#E2E8F0]">
        {[
          {
            key: "emailAlerts" as const,
            title: "Notificaciones por correo electrónico",
            desc: "Recibe comprobantes de creación y cierre de órdenes de servicio.",
          },
          {
            key: "statusUpdates" as const,
            title: "Alertas de cambio de estado",
            desc: "Aviso inmediato cuando un técnico acepte o inicie tu servicio.",
          },
          {
            key: "twoFactorHint" as const,
            title: "Confirmación adicional en cambios sensibles",
            desc: "Solicitar verificación al modificar datos de contacto.",
          },
        ].map((item) => (
          <div
            key={item.key}
            className="p-5 flex items-center justify-between gap-4"
          >
            <div>
              <h3 className="text-sm font-bold text-[#0F172A]">{item.title}</h3>
              <p className="text-xs text-[#64748B] mt-0.5">{item.desc}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefs[item.key]}
              aria-label={item.title}
              onClick={() => togglePref(item.key)}
              className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 cursor-pointer ${
                prefs[item.key] ? "bg-[#2563EB]" : "bg-slate-300"
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-xs transition-transform ${
                  prefs[item.key] ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ClientDashboardPage() {
  const { user, requests, logoutLocal, showToast } = useNav();
  const [tab, setTab] = useState<ClientTab>("overview");
  const [apiRequests, setApiRequests] = useState<ApiServiceRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  const loadRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const res = await getServiceRequests({ per_page: 50 });
      const list = res.data?.data ?? res.data ?? [];
      if (Array.isArray(list)) {
        setApiRequests(list);
      }
    } catch {
      // Mantiene lista actual
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests, requests.length]);

  const navItems: DashboardNavItem<ClientTab>[] = [
    { id: "overview", label: "Inicio", icon: Home },
    { id: "search", label: "Buscar Técnicos", icon: Search },
    {
      id: "requests",
      label: "Mis Solicitudes",
      icon: FileText,
      badgeCount: apiRequests.length,
    },
    { id: "profile", label: "Mi Perfil", icon: User },
    { id: "settings", label: "Configuración", icon: Settings },
  ];

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch {
      // Limpia sesión local incluso si el token ya expiró
    } finally {
      showToast({ type: "info", title: "Sesión cerrada" });
      logoutLocal("home");
    }
  };

  return (
    <DashboardShell
      role="client"
      navItems={navItems}
      activeTab={tab}
      onSelectTab={(nextTab) => setTab(nextTab as ClientTab)}
      accountTitle={user?.name ?? "Mi Cuenta Cliente"}
      accountSubtitle="Portal de servicios"
    >
      {tab === "overview" && (
        <ClientOverview
          apiRequests={apiRequests}
          loadingRequests={loadingRequests}
          onNavigateTab={setTab}
        />
      )}
      {tab === "search" && <ClientSearchView />}
      {tab === "requests" && (
        <ClientRequestsView
          apiRequests={apiRequests}
          loadingRequests={loadingRequests}
          onRefresh={loadRequests}
        />
      )}
      {tab === "profile" && <ClientProfileView onLogout={handleLogout} />}
      {tab === "settings" && <ClientSettingsView />}
    </DashboardShell>
  );
}