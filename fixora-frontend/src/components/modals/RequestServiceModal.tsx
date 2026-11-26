import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Calendar,
  Clock,
  MailCheck,
  MapPin,
  RefreshCw,
  Tag,
  Wrench,
  X,
} from "lucide-react";
import { PhotoUploader } from "@/components/common/PhotoUploader";
import { useNav } from "@/context/NavigationContext";
import {
  createServiceRequest,
  getApiErrorMessage,
  getPublicTechnician,
  getSpecialties,
  resendVerificationEmail,
  searchTechnicians,
} from "@/services/api";
import type { TechnicianSummary } from "@/types";

interface SpecialtyOption {
  id: number;
  name: string;
}

interface CatalogServiceOption {
  id: number;
  specialty_id?: number | null;
  title: string;
  description?: string | null;
  reference_price?: string | number | null;
  is_active?: boolean;
}

interface TechnicianOption {
  profileId: number;
  name: string;
  specialties: SpecialtyOption[];
  services: CatalogServiceOption[];
}

interface RequestServiceModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  defaultSpecialty?: string;
  technician?: TechnicianSummary;
  onCreated?: () => void;
}

const OTHER_SPECIALTY_VALUE = "__other__";

export function RequestServiceModal({
  isOpen = true,
  onClose,
  defaultSpecialty: propDefaultSpecialty,
  technician: propTechnician,
  onCreated,
}: RequestServiceModalProps) {
  const {
    modal,
    user,
    refreshUser,
    closeModal,
    showToast,
    refreshRequests,
  } = useNav() as ReturnType<typeof useNav> & {
    refreshRequests?: () => Promise<void> | void;
  };

  const modalData =
    modal && modal.type === "request-service" ? modal : undefined;
  const activeTechnician = propTechnician ?? modalData?.technician;
  const activeDefaultSpecialty =
    propDefaultSpecialty ?? modalData?.defaultSpecialty;
  const activeDefaultZone = modalData?.defaultZone;
  const activeDefaultTitle = modalData?.defaultTitle;

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else if (closeModal) {
      closeModal();
    }
  };

  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [catalogSpecialties, setCatalogSpecialties] = useState<SpecialtyOption[]>(
    []
  );
  const [techSpecialties, setTechSpecialties] = useState<SpecialtyOption[]>([]);
  const [techServices, setTechServices] = useState<CatalogServiceOption[]>([]);

  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>(() =>
    activeTechnician?.id ? String(activeTechnician.id) : ""
  );
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("");
  const [customSpecialty, setCustomSpecialty] = useState<string>("");

  const [title, setTitle] = useState<string>(activeDefaultTitle ?? "");
  const [description, setDescription] = useState<string>("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [approxZone, setApproxZone] = useState<string>(activeDefaultZone ?? "");
  const [addressLine, setAddressLine] = useState<string>("");
  const [preferredDate, setPreferredDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });
  const [preferredStart, setPreferredStart] = useState<string>("09:00");

  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [resendingEmail, setResendingEmail] = useState<boolean>(false);
  const [checkingVerification, setCheckingVerification] =
    useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const techniciansRef = useRef<TechnicianOption[]>([]);
  useEffect(() => {
    techniciansRef.current = technicians;
  }, [technicians]);

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;

    setLoadingInitial(true);
    setError(null);
    setPhotos([]);
    if (activeDefaultZone) setApproxZone(activeDefaultZone);
    if (activeDefaultTitle) setTitle(activeDefaultTitle);

    if (activeTechnician?.id) {
      const preId = Number(activeTechnician.id);
      setSelectedTechnicianId(String(activeTechnician.id));
      if (preId > 0) {
        setTechnicians((prev) =>
          prev.some((t) => t.profileId === preId)
            ? prev
            : [
                {
                  profileId: preId,
                  name: activeTechnician.name,
                  specialties: Array.isArray(activeTechnician.specialties)
                    ? activeTechnician.specialties.map((s) => ({
                        id: s.id,
                        name: s.name,
                      }))
                    : [],
                  services: Array.isArray(activeTechnician.services)
                    ? activeTechnician.services.map((sv) => ({
                        id: sv.id,
                        specialty_id: sv.specialty_id,
                        title: sv.title,
                        description: sv.description ?? null,
                        reference_price: sv.reference_price ?? null,
                        is_active: true,
                      }))
                    : [],
                },
                ...prev,
              ]
        );
      }
    }

    (async () => {
      await refreshUser();

      try {
        const [techRes, specRes] = await Promise.allSettled([
          searchTechnicians({ per_page: 24 }),
          getSpecialties(),
        ]);

        if (!mounted) return;

        let parsedSpecs: SpecialtyOption[] = [];
        if (specRes.status === "fulfilled") {
          const rawSpecs =
            specRes.value.data?.data ?? specRes.value.data ?? [];
          if (Array.isArray(rawSpecs)) {
            parsedSpecs = rawSpecs.map((s: Record<string, unknown>) => ({
              id: Number(s.id),
              name: String(s.name ?? ""),
            }));
            setCatalogSpecialties(parsedSpecs);
          }
        }

        const mappedTechs: TechnicianOption[] = [];
        if (techRes.status === "fulfilled") {
          const rawTechs =
            techRes.value.data?.data ?? techRes.value.data ?? [];
          if (Array.isArray(rawTechs)) {
            for (const item of rawTechs as Array<Record<string, unknown>>) {
              const profileObj =
                (item.technician_profile as Record<string, unknown>) ??
                (item.technicianProfile as Record<string, unknown>) ??
                item;
              const userObj =
                (item.user as Record<string, unknown>) ??
                (profileObj.user as Record<string, unknown>) ??
                item;

              const profileId = Number(profileObj.id ?? item.id ?? 0);
              const name = String(
                userObj.name ?? item.name ?? "Especialista Fixora"
              );

              const rawItemSpecs = Array.isArray(profileObj.specialties)
                ? profileObj.specialties
                : Array.isArray(item.specialties)
                  ? item.specialties
                  : [];

              const specs: SpecialtyOption[] = rawItemSpecs.map(
                (sp: Record<string, unknown>) => ({
                  id: Number(sp.id),
                  name: String(sp.name ?? ""),
                })
              );

              const rawItemServices = Array.isArray(profileObj.services)
                ? profileObj.services
                : Array.isArray(item.services)
                  ? item.services
                  : [];

              const services: CatalogServiceOption[] = rawItemServices
                .filter((sv: Record<string, unknown>) => sv.is_active !== false)
                .map((sv: Record<string, unknown>) => ({
                  id: Number(sv.id),
                  specialty_id: sv.specialty_id ? Number(sv.specialty_id) : null,
                  title: String(sv.title ?? ""),
                  description:
                    typeof sv.description === "string" ? sv.description : null,
                  reference_price:
                    sv.reference_price !== undefined
                      ? (sv.reference_price as string | number | null)
                      : null,
                  is_active: sv.is_active !== false,
                }));

              if (profileId > 0) {
                mappedTechs.push({
                  profileId,
                  name,
                  specialties: specs,
                  services,
                });
              }
            }
          }
        }

        if (activeTechnician) {
          const preId = Number(activeTechnician.id);
          if (
            preId > 0 &&
            !mappedTechs.some((t) => t.profileId === preId)
          ) {
            mappedTechs.unshift({
              profileId: preId,
              name: activeTechnician.name,
              specialties: Array.isArray(activeTechnician.specialties)
                ? activeTechnician.specialties.map((s) => ({
                    id: s.id,
                    name: s.name,
                  }))
                : [],
              services: Array.isArray(activeTechnician.services)
                ? activeTechnician.services.map((sv) => ({
                    id: sv.id,
                    specialty_id: sv.specialty_id,
                    title: sv.title,
                    description: sv.description ?? null,
                    reference_price: sv.reference_price ?? null,
                    is_active: true,
                  }))
                : [],
            });
          }
        }

        setTechnicians(mappedTechs);

        const initialTechId = activeTechnician?.id
          ? String(activeTechnician.id)
          : mappedTechs[0]
            ? String(mappedTechs[0].profileId)
            : "";
        setSelectedTechnicianId(initialTechId);

        const initialTech = mappedTechs.find(
          (t) => String(t.profileId) === initialTechId
        );
        const availableSpecs =
          initialTech && initialTech.specialties.length > 0
            ? initialTech.specialties
            : parsedSpecs;
        setTechSpecialties(availableSpecs);
        setTechServices(initialTech?.services ?? []);

        if (activeDefaultSpecialty && activeDefaultSpecialty.trim() !== "") {
          const found = availableSpecs.find(
            (s) =>
              s.name.toLowerCase() ===
              activeDefaultSpecialty.trim().toLowerCase()
          );
          if (found) {
            setSelectedSpecialty(String(found.id));
            setCustomSpecialty("");
          } else {
            setSelectedSpecialty(OTHER_SPECIALTY_VALUE);
            setCustomSpecialty(activeDefaultSpecialty.trim());
          }
        } else if (availableSpecs.length > 0) {
          setSelectedSpecialty(String(availableSpecs[0].id));
        } else {
          setSelectedSpecialty(OTHER_SPECIALTY_VALUE);
        }
      } finally {
        if (mounted) setLoadingInitial(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [
    isOpen,
    activeTechnician,
    activeDefaultSpecialty,
    activeDefaultZone,
    activeDefaultTitle,
    refreshUser,
  ]);

  useEffect(() => {
    if (!isOpen || !selectedTechnicianId) return;
    let mounted = true;

    setSelectedServiceId("");

    const localTech = techniciansRef.current.find(
      (t) => String(t.profileId) === selectedTechnicianId
    );
    if (localTech) {
      setTechServices(localTech.services);
      if (localTech.specialties.length > 0) {
        setTechSpecialties(localTech.specialties);
        setSelectedSpecialty((prev) =>
          prev === OTHER_SPECIALTY_VALUE
            ? prev
            : String(localTech.specialties[0].id)
        );
      }
    }

    getPublicTechnician(selectedTechnicianId)
      .then((res) => {
        if (!mounted) return;
        const prof = res.data?.data ?? res.data ?? {};
        const rawSpecs = Array.isArray(prof.specialties)
          ? prof.specialties
          : [];
        if (rawSpecs.length > 0) {
          const parsed: SpecialtyOption[] = rawSpecs.map(
            (s: Record<string, unknown>) => ({
              id: Number(s.id),
              name: String(s.name ?? ""),
            })
          );
          setTechSpecialties(parsed);
          setSelectedSpecialty((prev) => {
            if (prev === OTHER_SPECIALTY_VALUE) return prev;
            if (parsed.some((p) => String(p.id) === prev)) return prev;
            return String(parsed[0].id);
          });
        }

        const rawSrvs = Array.isArray(prof.services) ? prof.services : [];
        const activeSrvs: CatalogServiceOption[] = rawSrvs
          .filter((sv: Record<string, unknown>) => sv.is_active !== false)
          .map((sv: Record<string, unknown>) => ({
            id: Number(sv.id),
            specialty_id: sv.specialty_id ? Number(sv.specialty_id) : null,
            title: String(sv.title ?? ""),
            description:
              typeof sv.description === "string" ? sv.description : null,
            reference_price:
              sv.reference_price !== undefined
                ? (sv.reference_price as string | number | null)
                : null,
            is_active: sv.is_active !== false,
          }));
        setTechServices(activeSrvs);
      })
      .catch(() => {
        // Conserva datos locales si falla
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, selectedTechnicianId]);

  const specialtyOptions = useMemo(() => {
    return techSpecialties.length > 0 ? techSpecialties : catalogSpecialties;
  }, [techSpecialties, catalogSpecialties]);

  const handleSelectPackage = (serviceIdStr: string) => {
    setSelectedServiceId(serviceIdStr);
    if (!serviceIdStr) return;

    const chosen = techServices.find((s) => String(s.id) === serviceIdStr);
    if (chosen) {
      setTitle(chosen.title);
      if (chosen.description && !description.trim()) {
        setDescription(chosen.description);
      }
      if (chosen.specialty_id) {
        setSelectedSpecialty(String(chosen.specialty_id));
        setCustomSpecialty("");
      }
    }
  };

  const handleCheckVerification = async () => {
    setCheckingVerification(true);
    const updated = await refreshUser();
    setCheckingVerification(false);

    if (updated?.email_verified_at) {
      setError(null);
      showToast?.({
        type: "success",
        title: "Correo confirmado",
        message: "Tu cuenta ya está verificada. Ya puedes enviar la solicitud.",
      });
    } else {
      showToast?.({
        type: "info",
        title: "Aún pendiente en el servidor",
        message: `El correo ${user?.email ?? ""} todavía aparece sin verificar en la base de datos.`,
      });
    }
  };

  const handleResendEmail = async () => {
    setResendingEmail(true);
    try {
      await resendVerificationEmail();
      showToast?.({
        type: "success",
        title: "Enlace enviado",
        message: `Revisa la bandeja de ${user?.email ?? "tu correo"} y haz clic en verificar.`,
      });
    } catch (err: unknown) {
      showToast?.({
        type: "error",
        title: "No se pudo reenviar",
        message: getApiErrorMessage(err, "Intenta de nuevo en unos minutos."),
      });
    } finally {
      setResendingEmail(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const profileId = Number(selectedTechnicianId);
    if (!profileId) {
      setError("Selecciona un técnico especialista.");
      return;
    }

    const isOther = selectedSpecialty === OTHER_SPECIALTY_VALUE;
    const cleanCustom = customSpecialty.trim();

    if (isOther && !cleanCustom) {
      setError("Especifica qué especialidad o servicio necesitas.");
      return;
    }

    const specialtyId = !isOther ? Number(selectedSpecialty) : undefined;
    if (!isOther && !specialtyId) {
      setError("Selecciona una especialidad válida.");
      return;
    }

    if (!title.trim() || !description.trim()) {
      setError("Completa el título y la descripción del servicio.");
      return;
    }

    setSubmitting(true);

    try {
      await createServiceRequest({
        technician_profile_id: profileId,
        technician_service_id: selectedServiceId
          ? Number(selectedServiceId)
          : null,
        ...(isOther
          ? { specialty_name: cleanCustom }
          : { specialty_id: specialtyId }),
        title: title.trim(),
        description: description.trim(),
        approx_zone: approxZone.trim(),
        address_line: addressLine.trim(),
        preferred_date: preferredDate,
        preferred_start: preferredStart,
        photos,
      });

      showToast?.({
        type: "success",
        title: "Solicitud enviada",
        message:
          photos.length > 0
            ? `Tu orden fue enviada al técnico con ${photos.length} foto(s) adjunta(s).`
            : "Tu orden de servicio fue enviada al técnico especialista.",
      });

      setPhotos([]);

      if (refreshRequests) {
        await refreshRequests();
      }
      if (onCreated) {
        onCreated();
      }
      handleClose();
    } catch (err: unknown) {
      await refreshUser();
      setError(
        getApiErrorMessage(err, "No se pudo crear la solicitud de servicio.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isUnverified = Boolean(user && !user.email_verified_at);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-2.5 sm:p-4"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado fijo */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-blue-50 text-[#1D63ED] shrink-0">
              <Wrench className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold text-[#0F172A] truncate">
                Solicitar Servicio Técnico
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                Nueva orden de servicio
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo con scroll interno adaptable */}
        <form
          id="request-service-form"
          onSubmit={handleSubmit}
          className="flex-1 min-h-0 overflow-y-auto px-4 py-3.5 sm:px-6 sm:py-4 space-y-3"
        >
          {/* Banner de error o verificación pendiente */}
          {(error || isUnverified) && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700 space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  {error ||
                    `Tu cuenta (${user?.email ?? ""}) aún aparece sin correo verificado.`}
                </span>
              </div>

              {isUnverified && (
                <div className="flex flex-wrap items-center gap-2 pl-6">
                  <button
                    type="button"
                    disabled={checkingVerification}
                    onClick={() => void handleCheckVerification()}
                    className="inline-flex items-center gap-1 rounded-lg bg-white border border-red-200 px-2.5 py-1 text-[11px] font-bold text-red-800 hover:bg-red-100/60"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${checkingVerification ? "animate-spin" : ""}`}
                    />
                    Ya lo verifiqué
                  </button>
                  <button
                    type="button"
                    disabled={resendingEmail}
                    onClick={() => void handleResendEmail()}
                    className="inline-flex items-center gap-1 rounded-lg bg-red-700 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-800 disabled:opacity-60"
                  >
                    <MailCheck className="w-3 h-3" />
                    {resendingEmail ? "Enviando..." : "Reenviar enlace"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Fila 1: Técnico + Especialidad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                Técnico especialista
              </label>
              <select
                value={selectedTechnicianId}
                onChange={(e) => setSelectedTechnicianId(e.target.value)}
                disabled={loadingInitial}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-[#0F172A] focus:border-[#1D63ED] focus:outline-none"
              >
                {technicians.length === 0 ? (
                  <option value={selectedTechnicianId}>
                    {activeTechnician?.name ??
                      (loadingInitial
                        ? "Cargando especialistas..."
                        : "Sin técnicos disponibles")}
                  </option>
                ) : (
                  technicians.map((tech) => (
                    <option key={tech.profileId} value={String(tech.profileId)}>
                      {tech.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                Especialidad
              </label>
              <select
                value={selectedSpecialty}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedSpecialty(val);
                  if (val !== OTHER_SPECIALTY_VALUE) {
                    setCustomSpecialty("");
                  }
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-[#0F172A] focus:border-[#1D63ED] focus:outline-none"
              >
                {specialtyOptions.map((spec) => (
                  <option key={spec.id} value={String(spec.id)}>
                    {spec.name}
                  </option>
                ))}
                <option value={OTHER_SPECIALTY_VALUE}>
                  Otra especialidad...
                </option>
              </select>
            </div>
          </div>

          {/* Selector de Paquete / Tarifario del técnico */}
          {techServices.length > 0 && (
            <div className="rounded-xl bg-blue-50/50 border border-blue-200/80 px-3 py-2.5">
              <label className="flex items-center gap-1.5 text-xs font-bold text-[#0F172A] mb-1">
                <Tag className="w-3.5 h-3.5 text-[#1D63ED]" />
                Tarifario del especialista (opcional)
              </label>
              <select
                value={selectedServiceId}
                onChange={(e) => handleSelectPackage(e.target.value)}
                className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs sm:text-sm text-[#0F172A] focus:border-[#1D63ED] focus:outline-none"
              >
                <option value="">
                  Servicio personalizado (describir problema abajo)
                </option>
                {techServices.map((srv) => (
                  <option key={srv.id} value={String(srv.id)}>
                    {srv.title}
                    {srv.reference_price !== null &&
                    srv.reference_price !== undefined
                      ? ` — $${Number(srv.reference_price).toFixed(0)} MXN`
                      : " — A cotizar"}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Fila 2: Especialidad personalizada (si aplica) + Título breve */}
          <div
            className={`grid grid-cols-1 ${
              selectedSpecialty === OTHER_SPECIALTY_VALUE ? "sm:grid-cols-2" : ""
            } gap-3`}
          >
            {selectedSpecialty === OTHER_SPECIALTY_VALUE && (
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Especifica qué especialidad necesitas
                </label>
                <input
                  type="text"
                  required
                  value={customSpecialty}
                  onChange={(e) => setCustomSpecialty(e.target.value)}
                  placeholder="Ej. Carpintero, Herrería, CCTV..."
                  className="w-full rounded-xl border border-[#1D63ED] bg-blue-50/30 px-3 py-2 text-xs sm:text-sm text-[#0F172A] focus:border-[#1D63ED] focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                Título breve del problema o trabajo
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Mantenimiento preventivo de aire acondicionado"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs sm:text-sm text-[#0F172A] focus:border-[#1D63ED] focus:outline-none"
              />
            </div>
          </div>

          {/* Descripción detallada compacta */}
          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1">
              Descripción detallada
            </label>
            <textarea
              rows={2}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explica los síntomas, equipo o materiales involucrados..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs sm:text-sm text-[#0F172A] focus:border-[#1D63ED] focus:outline-none resize-none"
            />
          </div>

          {/* Subida opcional de fotos */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <PhotoUploader
              label="Fotos del problema o zona de trabajo (opcional)"
              helperText="Opcional • JPG, PNG o WEBP (máx. 4 fotos de 4 MB)"
              files={photos}
              onChange={setPhotos}
              maxFiles={4}
              onError={(msg) =>
                showToast?.({
                  type: "error",
                  title: "Imagen no válida",
                  message: msg,
                })
              }
            />
          </div>

          {/* Fila: Colonia + Dirección exacta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1 text-xs font-bold text-[#0F172A] mb-1">
                <MapPin className="w-3.5 h-3.5 text-[#1D63ED]" />
                Colonia o zona aproximada
              </label>
              <input
                type="text"
                required
                value={approxZone}
                onChange={(e) => setApproxZone(e.target.value)}
                placeholder="Ej. Playa Norte"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs sm:text-sm text-[#0F172A] focus:border-[#1D63ED] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                Dirección exacta (visible solo al aceptar)
              </label>
              <input
                type="text"
                required
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                placeholder="Calle, número exterior/interior y referencias"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs sm:text-sm text-[#0F172A] focus:border-[#1D63ED] focus:outline-none"
              />
            </div>
          </div>

          {/* Fila: Fecha preferida + Hora de inicio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1 text-xs font-bold text-[#0F172A] mb-1">
                <Calendar className="w-3.5 h-3.5 text-[#1D63ED]" />
                Fecha preferida
              </label>
              <input
                type="date"
                required
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs sm:text-sm text-[#0F172A] focus:border-[#1D63ED] focus:outline-none"
              />
            </div>

            <div>
              <label className="flex items-center gap-1 text-xs font-bold text-[#0F172A] mb-1">
                <Clock className="w-3.5 h-3.5 text-[#1D63ED]" />
                Hora de inicio
              </label>
              <input
                type="time"
                required
                value={preferredStart}
                onChange={(e) => setPreferredStart(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs sm:text-sm text-[#0F172A] focus:border-[#1D63ED] focus:outline-none"
              />
            </div>
          </div>
        </form>

        {/* Pie fijo con botones de acción */}
        <div className="shrink-0 px-4 py-3 sm:px-6 sm:py-3.5 flex items-center justify-end gap-2.5 border-t border-slate-100 bg-slate-50/60">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="submit"
            form="request-service-form"
            disabled={submitting || loadingInitial}
            className="rounded-xl bg-[#1D63ED] px-5 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors cursor-pointer"
          >
            {submitting ? "Enviando solicitud..." : "Enviar Solicitud"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RequestServiceModal;