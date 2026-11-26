import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  MapPin,
  Menu,
  Plus,
  Search,
  Star,
  User,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { BrandLogo } from "@/components/common/BrandLogo";
import { Button } from "@/components/forms/Button";
import { SharedFooter } from "@/components/layout/SharedFooter";
import { CLIENT_BENEFITS, CLIENT_FAQ, SPECIALTIES } from "@/constants/fixoraData";
import { useNav } from "@/context/NavigationContext";
import { getSpecialties, searchTechnicians } from "@/services/api";

const NAV_LINKS = [
  { label: "Inicio", href: "#inicio" },
  { label: "Cómo funciona", href: "#como-funciona" },
  { label: "Servicios", href: "#servicios" },
  { label: "Técnicos", href: "#tecnicos-destacados" },
  { label: "Beneficios", href: "#beneficios" },
  { label: "Preguntas", href: "#faq" },
];

interface ApiSpecialtyItem {
  id?: number | string;
  name: string;
}

interface FeaturedTechItem {
  id: number;
  headline?: string | null;
  service_zone?: string | null;
  years_experience?: number | null;
  rating_avg?: string | number | null;
  is_available?: boolean;
  user?: { name?: string | null } | null;
  specialties?: Array<{ id?: number; name: string }>;
  services?: Array<{
    id: number;
    title: string;
    reference_price?: string | number | null;
    is_active?: boolean;
  }>;
}

function ClientNavbar() {
  const { go, user } = useNav();
  const [menuOpen, setMenuOpen] = useState(false);

  const dashboardTarget =
    user?.role === "technician" ? "tech-dashboard" : "client-dashboard";

  return (
    <nav
      aria-label="Navegación principal"
      className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b-2 border-[#0F172A]/15"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <button
            type="button"
            onClick={() => go("home")}
            className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] rounded-lg"
            aria-label="Fixora inicio"
          >
            <BrandLogo size="md" />
          </button>
          <div className="hidden lg:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-semibold text-[#475569] hover:text-[#2563EB] transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2.5">
          {user ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => go(dashboardTarget)}
            >
              Ir a Mi Panel
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => go("client-login")}>
                Iniciar Sesión
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => go("client-register")}
              >
                Registrarse
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => go("tech-landing")}
              >
                ¿Eres Técnico?
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((prev) => !prev)}
          className="md:hidden p-2.5 text-[#475569] hover:text-[#0F172A] rounded-xl hover:bg-slate-100 cursor-pointer"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-[#E2E8F0] bg-white px-4 py-4 flex flex-col gap-1 shadow-lg">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="text-sm font-semibold text-[#334155] py-3 px-2 rounded-xl hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
            >
              {link.label}
            </a>
          ))}
          <div className="pt-3 flex flex-col gap-2">
            {user ? (
              <Button
                variant="primary"
                className="w-full"
                onClick={() => {
                  go(dashboardTarget);
                  setMenuOpen(false);
                }}
              >
                Ir a Mi Panel
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    go("client-login");
                    setMenuOpen(false);
                  }}
                >
                  Iniciar Sesión
                </Button>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    go("client-register");
                    setMenuOpen(false);
                  }}
                >
                  Registrarse
                </Button>
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => {
                    go("tech-landing");
                    setMenuOpen(false);
                  }}
                >
                  ¿Eres Técnico?
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

export function ClientLandingPage() {
  const { go, user, setSelectedSpecialty, showToast } = useNav();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Estado de búsqueda inicial
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSpecialty, setSearchSpecialty] = useState("");
  const [searchZone, setSearchZone] = useState("Ciudad del Carmen");

  // Datos reales desde la API
  const [apiSpecialties, setApiSpecialties] = useState<string[]>(
    SPECIALTIES.map((s) => s.label)
  );
  const [featuredTechs, setFeaturedTechs] = useState<FeaturedTechItem[]>([]);
  const [loadingTechs, setLoadingTechs] = useState(true);

  useEffect(() => {
    let active = true;

    getSpecialties()
      .then((res) => {
        if (!active) return;
        const raw: ApiSpecialtyItem[] = res.data?.data ?? res.data ?? [];
        if (Array.isArray(raw) && raw.length > 0) {
          const names = raw
            .map((item) => item.name)
            .filter((n): n is string => Boolean(n && n.trim()));
          if (names.length > 0) setApiSpecialties(names);
        }
      })
      .catch(() => {
        // Mantiene SPECIALTIES como respaldo
      });

    setLoadingTechs(true);
    searchTechnicians({ per_page: 6 })
      .then((res) => {
        if (!active) return;
        const rawTechs = res.data?.data ?? res.data ?? [];
        setFeaturedTechs(Array.isArray(rawTechs) ? rawTechs.slice(0, 6) : []);
      })
      .catch(() => {
        if (active) setFeaturedTechs([]);
      })
      .finally(() => {
        if (active) setLoadingTechs(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleInitialSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchSpecialty) {
      setSelectedSpecialty(searchSpecialty);
    }

    if (user?.role === "client") {
      go("client-dashboard");
      return;
    }

    showToast({
      type: "info",
      title: searchSpecialty
        ? `Búsqueda: ${searchSpecialty}`
        : "Explorar técnicos disponibles",
      message:
        "Inicia sesión o crea tu cuenta gratis para solicitar y cotizar con especialistas.",
    });
    go("client-register");
  };

  const handleSelectCategory = (label: string) => {
    setSelectedSpecialty(label);
    if (user?.role === "client") {
      go("client-dashboard");
      return;
    }
    showToast({
      type: "info",
      title: `Especialidad: ${label}`,
      message: "Inicia sesión o regístrate para ver técnicos disponibles.",
    });
    go("client-login");
  };

  return (
    <div id="inicio" className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <ClientNavbar />

      {/* HERO BLUEPRINT / INDUSTRIAL */}
      <section className="bg-gradient-to-br from-[#EFF6FF] via-white to-[#F0F9FF] bg-blueprint-light py-12 sm:py-16 lg:py-20 border-b-2 border-[#0F172A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 bg-[#0B1120] text-[#FACC15] border border-[#0F172A] px-3.5 py-1.5 rounded-full font-mono text-xs font-bold mb-5">
                <Zap size={14} />
                ÓRDENES TÉCNICAS CON SEGUIMIENTO Y COTIZACIÓN
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#0F172A] leading-[1.12] mb-5">
                Conecta con el{" "}
                <span className="text-[#2563EB]">técnico adecuado</span>{" "}
                para tu hogar o negocio
              </h1>

              <p className="text-base sm:text-lg text-[#475569] mb-7 max-w-xl leading-relaxed">
                Solicita especialistas verificados por área, dialoga para cotizar y da seguimiento por folio a cada orden de servicio.
              </p>

              <div className="flex flex-col sm:flex-row flex-wrap gap-3">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() =>
                    go(user?.role === "client" ? "client-dashboard" : "client-register")
                  }
                >
                  <Search size={18} />
                  Buscar Técnico
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => go(user ? "client-dashboard" : "client-login")}
                >
                  {user ? "Ir a mi panel" : "Ya tengo cuenta"}
                </Button>
                <Button variant="ghost" size="lg" onClick={() => go("tech-landing")}>
                  ¿Eres Técnico? →
                </Button>
              </div>
            </div>

            {/* Tarjeta estilo ticket industrial con dato real del primer técnico o plantilla */}
            <div className="lg:col-span-5">
              <div className="bg-white rounded-2xl border-2 border-[#0F172A] shadow-[7px_7px_0px_#0F172A] overflow-hidden">
                <div className="bg-[#0B1120] text-white px-5 py-3 flex items-center justify-between font-mono text-xs">
                  <span className="font-bold text-[#FACC15]">
                    ORDEN TÉCNICA • #FX-0001
                  </span>
                  <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-bold">
                    TRAZABLE
                  </span>
                </div>

                <div
                  className="h-2 w-full border-y border-[#0F172A]"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(45deg, #FACC15 0px, #FACC15 10px, #0B1120 10px, #0B1120 20px)",
                  }}
                />

                <div className="p-5 m-3 rounded-xl border-2 border-dashed border-slate-300 bg-[#F8FAFC] space-y-4">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-500 font-bold">
                      ESPECIALISTAS EN RED:
                    </span>
                    <span className="font-extrabold text-[#2563EB]">
                      {featuredTechs.length > 0
                        ? `${featuredTechs.length} destacados activos`
                        : `${apiSpecialties.length} especialidades`}
                    </span>
                  </div>

                  {featuredTechs[0] ? (
                    <div className="rounded-xl bg-white border border-slate-200 p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-extrabold text-sm text-[#0F172A]">
                          {featuredTechs[0].user?.name ?? "Especialista Fixora"}
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-amber-700">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          {Number(featuredTechs[0].rating_avg ?? 0) > 0
                            ? Number(featuredTechs[0].rating_avg).toFixed(1)
                            : "Nuevo"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">
                        {featuredTechs[0].specialties?.[0]?.name ??
                          featuredTechs[0].headline ??
                          "Servicio técnico verificado"}
                      </p>
                      <p className="font-mono text-[11px] text-slate-500">
                        Zona: {featuredTechs[0].service_zone || "Ciudad del Carmen"}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-white border border-slate-200 p-3.5">
                      <p className="text-xs font-bold text-[#0F172A]">
                        Cotización previa + Comprobante PDF
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Elige especialidad, acuerda alcance y descarga tu recibo al finalizar.
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      go(user?.role === "client" ? "client-dashboard" : "client-register")
                    }
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white font-bold py-2.5 px-4 text-xs sm:text-sm border-2 border-[#0F172A] shadow-[3px_3px_0px_#0F172A] cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Abrir solicitud de servicio
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* BARRA DE BÚSQUEDA INICIAL */}
          <form
            onSubmit={handleInitialSearchSubmit}
            className="mt-10 bg-white rounded-2xl border-2 border-[#0F172A] shadow-[6px_6px_0px_#0F172A] p-3.5 sm:p-4 grid grid-cols-1 md:grid-cols-12 gap-3"
          >
            <div className="md:col-span-4 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="¿Qué falla o servicio necesitas?"
                className="w-full rounded-xl border border-slate-300 bg-[#F8FAFC] pl-10 pr-3 py-2.5 text-xs sm:text-sm font-medium text-[#0F172A] focus:border-[#2563EB] focus:bg-white focus:outline-none"
              />
            </div>

            <div className="md:col-span-3">
              <select
                value={searchSpecialty}
                onChange={(e) => setSearchSpecialty(e.target.value)}
                aria-label="Especialidad"
                className="w-full rounded-xl border border-slate-300 bg-[#F8FAFC] px-3 py-2.5 text-xs sm:text-sm font-semibold text-[#0F172A] focus:border-[#2563EB] focus:bg-white focus:outline-none"
              >
                <option value="">Todas las especialidades</option>
                {apiSpecialties.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3 relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchZone}
                onChange={(e) => setSearchZone(e.target.value)}
                placeholder="Zona o colonia"
                className="w-full rounded-xl border border-slate-300 bg-[#F8FAFC] pl-10 pr-3 py-2.5 text-xs sm:text-sm font-medium text-[#0F172A] focus:border-[#2563EB] focus:bg-white focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                className="w-full h-full rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white font-extrabold text-xs sm:text-sm px-4 py-2.5 border-2 border-[#0F172A] shadow-[2px_2px_0px_#0F172A] transition-colors cursor-pointer"
              >
                Buscar Técnico
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* SPECIALTIES (CONECTADAS A LA API) */}
      <section id="servicios" className="scroll-mt-20 py-16 sm:py-20 bg-[#F8FAFC] border-b border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="font-mono text-xs font-bold text-[#2563EB] uppercase tracking-widest mb-2.5">
              Especialidades registradas
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0F172A] mb-3">
              Encuentra el servicio que necesitas
            </h2>
            <p className="text-[#475569] text-sm sm:text-base max-w-xl mx-auto">
              Selecciona una categoría para explorar especialistas disponibles en esa área.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {apiSpecialties.map((specName) => {
              const staticMatch = SPECIALTIES.find(
                (s) => s.label.toLowerCase() === specName.toLowerCase()
              );
              const IconComponent = staticMatch?.icon ?? Wrench;

              return (
                <button
                  key={specName}
                  type="button"
                  onClick={() => handleSelectCategory(specName)}
                  className="group text-left flex items-start gap-4 p-5 rounded-2xl bg-white border-2 border-[#0F172A] shadow-[4px_4px_0px_#0F172A] hover:bg-blue-50/40 transition-all duration-200 cursor-pointer"
                >
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                      staticMatch?.bg ?? "bg-[#EFF6FF]"
                    } group-hover:scale-105 transition-transform`}
                  >
                    <IconComponent
                      size={23}
                      className={staticMatch?.color ?? "text-[#2563EB]"}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-[#0F172A] group-hover:text-[#2563EB] transition-colors">
                      {specName}
                    </div>
                    <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                      {staticMatch?.description ??
                        "Especialistas disponibles para diagnóstico, instalación y reparación."}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* TÉCNICOS DESTACADOS REALES DESDE API */}
      <section
        id="tecnicos-destacados"
        className="scroll-mt-20 py-16 sm:py-20 bg-white border-b border-[#E2E8F0]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <p className="font-mono text-xs font-bold text-[#2563EB] uppercase tracking-widest mb-2">
                Directorio activo
              </p>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A]">
                Técnicos destacados
              </h2>
            </div>

            <button
              type="button"
              onClick={() =>
                go(user?.role === "client" ? "client-dashboard" : "client-login")
              }
              className="font-mono text-xs font-bold text-[#2563EB] hover:underline self-start sm:self-auto cursor-pointer"
            >
              Ver catálogo completo →
            </button>
          </div>

          {loadingTechs ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-56 rounded-2xl border-2 border-slate-200 bg-[#F8FAFC] animate-pulse"
                />
              ))}
            </div>
          ) : featuredTechs.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-[#F8FAFC] p-10 text-center">
              <p className="text-base font-extrabold text-[#0F172A]">
                Aún no hay técnicos destacados publicados
              </p>
              <p className="text-xs sm:text-sm text-[#64748B] mt-1">
                Regístrate o entra a tu panel para publicar una solicitud de servicio.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredTechs.map((tech) => {
                const techName = tech.user?.name ?? `Técnico #${tech.id}`;
                const primarySpec =
                  tech.specialties?.[0]?.name ??
                  tech.headline ??
                  "Servicio Técnico";
                const activeService = tech.services?.find(
                  (s) => s.is_active !== false
                );
                const priceLabel =
                  activeService?.reference_price !== null &&
                  activeService?.reference_price !== undefined
                    ? `$${Number(activeService.reference_price).toFixed(0)} MXN`
                    : "A cotizar";
                const ratingVal = Number(tech.rating_avg ?? 0);

                return (
                  <div
                    key={tech.id}
                    className="bg-[#F8FAFC] rounded-2xl border-2 border-[#0F172A] shadow-[5px_5px_0px_#0F172A] overflow-hidden flex flex-col justify-between"
                  >
                    <div className="p-5 m-2.5 rounded-xl border border-dashed border-slate-300 bg-white space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-bold px-2.5 py-0.5 rounded bg-[#EFF6FF] text-[#2563EB] border border-blue-200">
                          {primarySpec}
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-amber-700">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          {ratingVal > 0 ? ratingVal.toFixed(1) : "Nuevo"}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base font-extrabold text-[#0F172A]">
                          {techName}
                        </h3>
                        <p className="text-xs text-[#475569] mt-0.5 line-clamp-2">
                          {tech.headline || "Especialista verificado en Fixora"}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-dashed border-slate-200 flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-500 inline-flex items-center gap-1 truncate">
                          <MapPin className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                          {tech.service_zone || "Ciudad del Carmen"}
                        </span>
                        <span className="font-extrabold text-[#0F172A] bg-[#FACC15] px-2 py-0.5 rounded border border-[#0F172A]">
                          {priceLabel}
                        </span>
                      </div>
                    </div>

                    <div className="px-5 pb-4 pt-1 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {tech.is_available === false ? "Ocupado" : "Disponible"}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleSelectCategory(primarySpec)}
                        className="inline-flex items-center gap-1 rounded-xl bg-[#0B1120] hover:bg-slate-800 text-white font-bold px-3.5 py-2 text-xs cursor-pointer"
                      >
                        Solicitar
                        <ArrowRight className="w-3.5 h-3.5 text-[#FACC15]" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="como-funciona" className="scroll-mt-20 py-16 sm:py-20 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-14">
            <p className="font-mono text-xs font-bold text-[#2563EB] uppercase tracking-widest mb-2.5">
              Proceso simple
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0F172A] mb-3">
              ¿Cómo funciona Fixora?
            </h2>
            <p className="text-[#475569] text-sm sm:text-base max-w-xl mx-auto">
              En tres pasos claros encuentras al especialista ideal y mantienes control total de tu solicitud.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {[
              {
                icon: User,
                title: "1. Crea tu cuenta",
                desc: "Regístrate gratis con tus datos básicos para gestionar tus órdenes y direcciones.",
              },
              {
                icon: Search,
                title: "2. Elige especialidad",
                desc: "Filtra técnicos verificados según el tipo de reparación, disponibilidad y calificación.",
              },
              {
                icon: CheckCircle,
                title: "3. Agenda y da seguimiento",
                desc: "Define fecha, horario y detalles del problema. Recibe actualización en cada etapa.",
              },
            ].map((step) => (
              <div
                key={step.title}
                className="bg-white rounded-2xl p-6 border-2 border-[#0F172A] shadow-[4px_4px_0px_#0F172A] text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-[#EFF6FF] border border-[#DBEAFE] flex items-center justify-center mx-auto mb-5">
                  <step.icon size={25} className="text-[#2563EB]" />
                </div>
                <h3 className="text-lg font-bold text-[#0F172A] mb-2">{step.title}</h3>
                <p className="text-sm text-[#475569] leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section id="beneficios" className="scroll-mt-20 py-16 sm:py-20 bg-white border-t border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="font-mono text-xs font-bold text-[#2563EB] uppercase tracking-widest mb-2.5">
              ¿Por qué elegir Fixora?
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0F172A] mb-3">
              Beneficios pensados para tu tranquilidad
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {CLIENT_BENEFITS.map((b) => (
              <div
                key={b.title}
                className="bg-[#F8FAFC] rounded-2xl p-6 border border-[#E2E8F0] hover:bg-white hover:shadow-md transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-[#EFF6FF] flex items-center justify-center mb-4">
                  <b.icon size={21} className="text-[#2563EB]" />
                </div>
                <h3 className="font-bold text-[#0F172A] mb-1.5">{b.title}</h3>
                <p className="text-sm text-[#475569] leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 py-16 sm:py-20 bg-[#F8FAFC] border-t border-[#E2E8F0]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <p className="font-mono text-xs font-bold text-[#2563EB] uppercase tracking-widest mb-2">
              Dudas frecuentes
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A]">
              Preguntas frecuentes
            </h2>
          </div>

          <div className="space-y-3">
            {CLIENT_FAQ.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={item.q}
                  className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden"
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <span className="font-bold text-sm text-[#0F172A]">{item.q}</span>
                    <ChevronDown
                      size={18}
                      className={`flex-shrink-0 text-[#64748B] transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-3 text-sm text-[#475569] leading-relaxed border-t border-[#E2E8F0]">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20 bg-gradient-to-br from-[#0F172A] via-[#1E3A8A] to-[#2563EB]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center mx-auto mb-6">
            <Wrench size={26} className="text-white" />
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white mb-4">
            ¿Necesitas resolver una reparación hoy?
          </h2>
          <p className="text-blue-100 text-base sm:text-lg mb-8 max-w-xl mx-auto">
            Crea tu cuenta gratuita y solicita un especialista verificado en minutos.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              variant="secondary"
              size="lg"
              onClick={() =>
                go(user?.role === "client" ? "client-dashboard" : "client-register")
              }
            >
              <Search size={18} />
              Crear Cuenta Gratis
            </Button>
            <Button
              variant="light-outline"
              size="lg"
              onClick={() => go(user ? "client-dashboard" : "client-login")}
            >
              Explorar Panel Cliente
            </Button>
          </div>
        </div>
      </section>

      <SharedFooter />
    </div>
  );
}

export default ClientLandingPage;