import { useEffect, useState } from "react";
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Star,
  Tag,
  Wrench,
  X,
} from "lucide-react";
import { PhotoGallery } from "@/components/common/PhotoGallery";
import { Button } from "@/components/forms/Button";
import { useNav } from "@/context/NavigationContext";
import { getPublicTechnician } from "@/services/api";
import type { TechnicianSummary } from "@/types";

const STORAGE_FALLBACK_URL =
  "https://pub-b7af8ee9da664a46b57bb36890e0b545.r2.dev";

function normalizeAvatarUrl(url?: string | null): string | null {
  if (!url || !url.trim()) return null;
  const clean = url.trim();
  const storageMatch = clean.match(
    /^(?:https?:\/\/(?:localhost|127\.0\.0\.1|fixora-8jgn\.onrender\.com)(?::\d+)?)?\/storage\/(.+)$/i
  );
  if (storageMatch) {
    const base = (
      (import.meta.env.VITE_STORAGE_URL as string | undefined)?.trim() ||
      STORAGE_FALLBACK_URL
    ).replace(/\/+$/, "");
    return `${base}/${storageMatch[1]}`;
  }
  return clean;
}

interface PublicCompletedWork {
  id: number;
  title: string;
  specialty_name?: string | null;
  completed_at?: string | null;
  rating?: number | null;
  comment?: string | null;
  photos?: string[] | null;
}

interface PublicReviewItem {
  id: number;
  rating: number;
  comment?: string | null;
  photos?: string[] | null;
  technician_reply?: string | null;
  created_at?: string | null;
  client?: { name?: string };
  service_request?: {
    id?: number;
    title?: string;
    completed_at?: string | null;
    specialty?: { name?: string };
  };
}

interface TechnicianDetailModalProps {
  technician?: TechnicianSummary | null;
  onClose?: () => void;
}

export function TechnicianDetailModal({
  technician: propTech,
  onClose: propOnClose,
}: TechnicianDetailModalProps) {
  const { modal, closeModal, openModal } = useNav();

  const modalTech =
    modal && modal.type === "technician-detail" ? modal.technician : null;
  const tech = propTech ?? modalTech;

  const [bioExpanded, setBioExpanded] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [completedWorks, setCompletedWorks] = useState<PublicCompletedWork[]>(
    []
  );
  const [reviews, setReviews] = useState<PublicReviewItem[]>([]);
  const [realCompletedCount, setRealCompletedCount] = useState<number>(0);
  const [resolvedExpYears, setResolvedExpYears] = useState<number | null>(null);
  const [resolvedZone, setResolvedZone] = useState<string>("");
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState<string | null>(
    null
  );
  const [avatarError, setAvatarError] = useState(false);

  const handleClose = () => {
    if (propOnClose) {
      propOnClose();
    } else {
      closeModal();
    }
  };

  useEffect(() => {
    if (!tech?.id) return;
    let active = true;

    setBioExpanded(false);
    setReviews([]);
    setCompletedWorks([]);
    setAvatarError(false);
    setRealCompletedCount(tech.completedCount ?? 0);
    setResolvedAvatarUrl(
      normalizeAvatarUrl(tech.avatarUrl ?? tech.avatar_url ?? null)
    );
    setResolvedExpYears(
      tech.experienceYears && tech.experienceYears > 0
        ? tech.experienceYears
        : null
    );
    setResolvedZone(
      tech.city && tech.city !== "Zona local" ? tech.city : ""
    );

    (async () => {
      setLoadingDetails(true);
      try {
        const res = await getPublicTechnician(tech.id);
        const json = res.data;
        const data = json?.data ?? json ?? {};

        if (!active) return;

        const userObj =
          data.user && typeof data.user === "object"
            ? (data.user as Record<string, unknown>)
            : undefined;

        const rawAvatar =
          typeof data.avatar_url === "string" && data.avatar_url.trim()
            ? data.avatar_url
            : typeof userObj?.avatar_url === "string" &&
                userObj.avatar_url.trim()
              ? userObj.avatar_url
              : null;

        if (rawAvatar) {
          setAvatarError(false);
          setResolvedAvatarUrl(normalizeAvatarUrl(rawAvatar));
        }

        const rawExp = data.years_experience ?? data.experience_years;
        if (rawExp !== undefined && rawExp !== null && Number(rawExp) > 0) {
          setResolvedExpYears(Number(rawExp));
        }

        const rawZone =
          data.service_zone ?? data.service_area ?? data.zone ?? data.city;
        if (typeof rawZone === "string" && rawZone.trim()) {
          setResolvedZone(rawZone.trim());
        }

        const apiReviews: PublicReviewItem[] = Array.isArray(data.reviews)
          ? data.reviews
          : [];
        setReviews(apiReviews);

        const rawCompletedList = Array.isArray(data.completed_requests)
          ? data.completed_requests
          : Array.isArray(data.completed_services)
            ? data.completed_services
            : Array.isArray(data.works)
              ? data.works
              : null;

        const countFromApi =
          typeof data.completed_count === "number"
            ? data.completed_count
            : typeof data.completed_requests_count === "number"
              ? data.completed_requests_count
              : rawCompletedList
                ? rawCompletedList.length
                : Math.max(tech.completedCount ?? 0, apiReviews.length);

        setRealCompletedCount(countFromApi);

        if (rawCompletedList && rawCompletedList.length > 0) {
          setCompletedWorks(
            rawCompletedList.map((item: Record<string, unknown>) => ({
              id: Number(item.id),
              title: String(item.title ?? "Servicio técnico realizado"),
              specialty_name:
                (item.specialty as { name?: string } | undefined)?.name ??
                tech.specialty,
              completed_at:
                typeof item.completed_at === "string"
                  ? item.completed_at
                  : typeof item.preferred_date === "string"
                    ? item.preferred_date
                    : null,
              rating:
                (item.review as { rating?: number } | undefined)?.rating ?? null,
              comment:
                (item.review as { comment?: string } | undefined)?.comment ??
                null,
              photos: Array.isArray(
                (item.review as { photos?: string[] } | undefined)?.photos
              )
                ? ((item.review as { photos?: string[] }).photos ?? [])
                : Array.isArray(item.photos)
                  ? (item.photos as string[])
                  : [],
            }))
          );
        } else {
          const derivedWorks: PublicCompletedWork[] = apiReviews.map((rev) => ({
            id: rev.service_request?.id ?? rev.id,
            title:
              rev.service_request?.title ??
              `Servicio de ${rev.service_request?.specialty?.name ?? tech.specialty}`,
            specialty_name:
              rev.service_request?.specialty?.name ?? tech.specialty,
            completed_at:
              rev.service_request?.completed_at ?? rev.created_at ?? null,
            rating: rev.rating,
            comment: rev.comment ?? null,
            photos: rev.photos ?? [],
          }));
          setCompletedWorks(derivedWorks);
        }
      } catch {
        // Mantiene datos base si falla la consulta extendida
      } finally {
        if (active) setLoadingDetails(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [tech]);

  if (!tech) return null;

  const isLongBio = (tech.bio?.length ?? 0) > 220;
  const displayedBio =
    !isLongBio || bioExpanded
      ? tech.bio || "Especialista verificado disponible para atención técnica."
      : `${tech.bio.slice(0, 220).trim()}...`;

  const handleRequestFromDetail = () => {
    const enrichedTech: TechnicianSummary = {
      ...tech,
      avatarUrl: resolvedAvatarUrl ?? tech.avatarUrl,
      avatar_url: resolvedAvatarUrl ?? tech.avatar_url,
      experienceYears: resolvedExpYears ?? tech.experienceYears,
      city: resolvedZone || tech.city,
      completedCount: realCompletedCount,
    };
    openModal({ type: "request-service", technician: enrichedTech });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-[#0B1120] text-white flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
              {resolvedAvatarUrl && !avatarError ? (
                <img
                  src={resolvedAvatarUrl}
                  alt={tech.name}
                  onError={() => setAvatarError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Wrench size={24} />
              )}
            </div>

            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EFF6FF] text-[#2563EB] text-xs font-bold mb-2">
                <ShieldCheck size={14} />
                Perfil Técnico Verificado
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] leading-tight">
                {tech.name}
              </h2>
              <p className="text-sm font-medium text-[#475569] mt-0.5">
                {tech.headline || tech.specialty}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Cerrar"
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors shrink-0 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Cuerpo con scroll */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Métricas compactas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] p-3.5">
            <div className="text-center sm:border-r sm:border-slate-200/80 px-2">
              <span className="block text-[11px] font-medium text-[#64748B]">
                Trabajos realizados
              </span>
              <span className="mt-1 inline-flex items-center justify-center gap-1.5 text-sm font-extrabold text-[#0F172A]">
                <CheckCircle2 size={15} className="text-emerald-600" />
                {realCompletedCount}
              </span>
            </div>

            <div className="text-center sm:border-r sm:border-slate-200/80 px-2">
              <span className="block text-[11px] font-medium text-[#64748B]">
                Experiencia
              </span>
              <span className="mt-1 inline-flex items-center justify-center gap-1.5 text-sm font-extrabold text-[#0F172A]">
                <Briefcase size={15} className="text-[#2563EB]" />
                {resolvedExpYears ? `${resolvedExpYears} años` : "Verificado"}
              </span>
            </div>

            <div className="text-center sm:border-r sm:border-slate-200/80 px-2">
              <span className="block text-[11px] font-medium text-[#64748B]">
                Calificación
              </span>
              <span className="mt-1 inline-flex items-center justify-center gap-1 text-sm font-extrabold text-[#0F172A]">
                <Star
                  size={15}
                  className={
                    tech.reviewsCount > 0
                      ? "fill-amber-400 text-amber-400"
                      : "text-slate-300"
                  }
                />
                {tech.reviewsCount > 0 && tech.rating !== null
                  ? `${tech.rating.toFixed(1)} (${tech.reviewsCount})`
                  : "Nuevo"}
              </span>
            </div>

            <div className="text-center px-2">
              <span className="block text-[11px] font-medium text-[#64748B]">
                Zona
              </span>
              <span className="mt-1 inline-flex items-center justify-center gap-1 text-sm font-extrabold text-[#0F172A] truncate max-w-full">
                <MapPin size={15} className="text-[#2563EB] shrink-0" />
                <span className="truncate">
                  {resolvedZone || "Cobertura local"}
                </span>
              </span>
            </div>
          </div>

          {/* Acerca del especialista */}
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B] mb-2">
              Acerca del especialista
            </h3>
            <p className="text-sm text-[#334155] leading-relaxed">
              {displayedBio}
            </p>
            {isLongBio && (
              <button
                type="button"
                onClick={() => setBioExpanded((prev) => !prev)}
                className="mt-1.5 text-xs font-bold text-[#2563EB] hover:underline cursor-pointer"
              >
                {bioExpanded ? "Ver menos" : "Leer descripción completa"}
              </button>
            )}
          </div>

          {/* Trabajos realizados */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-600" />
                Trabajos realizados ({completedWorks.length || realCompletedCount})
              </h3>
            </div>

            {loadingDetails ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6 text-center text-xs text-slate-500">
                Cargando historial de trabajos...
              </div>
            ) : completedWorks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-5 text-center">
                <Wrench size={20} className="mx-auto text-slate-400 mb-1.5" />
                <p className="text-xs font-semibold text-slate-600">
                  {realCompletedCount > 0
                    ? `${realCompletedCount} servicio(s) completado(s) en la plataforma`
                    : "Aún no hay trabajos realizados publicados"}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Las evidencias de trabajos finalizados aparecerán aquí de forma ordenada.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {completedWorks.map((work) => (
                  <div
                    key={work.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col justify-between gap-2.5 hover:border-blue-200 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                          <CheckCircle2 size={10} />
                          Completado
                        </span>

                        {work.rating && (
                          <span className="inline-flex items-center gap-0.5 text-xs font-bold text-amber-600">
                            <Star
                              size={12}
                              className="fill-amber-400 text-amber-400"
                            />
                            {work.rating}.0
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-[#0F172A] line-clamp-1">
                        {work.title}
                      </h4>

                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                        {work.specialty_name && (
                          <span className="font-medium text-[#2563EB]">
                            {work.specialty_name}
                          </span>
                        )}
                        {work.completed_at && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar size={10} />
                            {work.completed_at.slice(0, 10)}
                          </span>
                        )}
                      </div>

                      {work.comment && (
                        <p className="mt-2 text-xs text-slate-600 line-clamp-2 italic">
                          "{work.comment}"
                        </p>
                      )}
                    </div>

                    {work.photos && work.photos.length > 0 && (
                      <div className="pt-1">
                        <PhotoGallery photos={work.photos} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tarifario */}
          {tech.services && tech.services.length > 0 && (
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B] mb-2.5 flex items-center gap-1.5">
                <Tag size={14} className="text-[#2563EB]" />
                Servicios y tarifas de referencia ({tech.services.length})
              </h3>
              <div className="space-y-2">
                {tech.services.map((srv) => (
                  <div
                    key={srv.id}
                    className="rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between gap-3 bg-slate-50/40"
                  >
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-[#0F172A] truncate">
                        {srv.title}
                      </p>
                      {srv.description && (
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                          {srv.description}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[#0F172A]">
                      {srv.reference_price !== null &&
                      srv.reference_price !== undefined
                        ? `$${Number(srv.reference_price).toFixed(0)} MXN`
                        : "A cotizar"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reseñas */}
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B] mb-2.5">
              Reseñas de clientes ({reviews.length || tech.reviewsCount || 0})
            </h3>

            {reviews.length === 0 ? (
              <p className="text-xs text-slate-400">
                Este especialista aún no tiene comentarios escritos.
              </p>
            ) : (
              <div className="space-y-2.5">
                {reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="rounded-2xl border border-slate-200/90 bg-[#F8FAFC] p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#0F172A]">
                        {rev.client?.name ?? "Cliente verificado"}
                      </span>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            size={12}
                            className={
                              s <= rev.rating
                                ? "fill-amber-400 text-amber-400"
                                : "text-slate-300"
                            }
                          />
                        ))}
                      </div>
                    </div>

                    {rev.comment && (
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {rev.comment}
                      </p>
                    )}

                    {rev.technician_reply && (
                      <div className="pl-3 border-l-2 border-[#2563EB] text-[11px] text-slate-600">
                        <span className="font-bold text-[#0F172A] inline-flex items-center gap-1">
                          <MessageSquare size={10} className="text-[#2563EB]" />
                          Respuesta del técnico:
                        </span>{" "}
                        {rev.technician_reply}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cerrar
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleRequestFromDetail}
          >
            Solicitar servicio
          </Button>
        </div>
      </div>
    </div>
  );
}