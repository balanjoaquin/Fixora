import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  Clock,
  DollarSign,
  Mail,
  MapPin,
  Menu,
  Phone,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { SPECIALTIES } from "@/constants/fixoraData";
import { useNav } from "@/context/NavigationContext";
import { getSpecialties, searchTechnicians } from "@/services/api";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "¿Tiene algún costo registrarme como técnico en Fixora?",
    answer:
      "No. Crear tu perfil técnico, publicar tus especialidades, definir tu tarifario y configurar tu disponibilidad semanal es gratuito.",
  },
  {
    question: "¿Puedo agregar especialidades y precios de referencia?",
    answer:
      "Sí. Desde tu panel técnico puedes publicar servicios con precio de referencia, cotizar por mensaje antes de aceptar y administrar tus horarios.",
  },
  {
    question: "¿Cómo se gestionan las órdenes de inicio a cierre?",
    answer:
      "Recibes la solicitud, dialogas para acordar alcance o cotización, aceptas la orden, la marcas como en proceso y al finalizar queda registrada con folio.",
  },
];

export function TechLandingPage() {
  const { go, user } = useNav();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [registeredTechsCount, setRegisteredTechsCount] = useState<number | null>(
    null
  );
  const [specialtiesList, setSpecialtiesList] = useState<string[]>(
    SPECIALTIES.map((s) => s.label)
  );

  useEffect(() => {
    let mounted = true;

    searchTechnicians({ per_page: 24 })
      .then((res) => {
        if (!mounted) return;
        const total =
          res.data?.meta?.total ??
          (Array.isArray(res.data?.data) ? res.data.data.length : null);
        if (typeof total === "number" && total > 0) {
          setRegisteredTechsCount(total);
        }
      })
      .catch(() => {
        // Sin datos públicos por ahora
      });

    getSpecialties()
      .then((res) => {
        if (!mounted) return;
        const raw = res.data?.data ?? res.data ?? [];
        if (Array.isArray(raw) && raw.length > 0) {
          const names = raw
            .map((item: { name?: string }) => item.name)
            .filter((n): n is string => Boolean(n && n.trim()));
          if (names.length > 0) setSpecialtiesList(names);
        }
      })
      .catch(() => {
        // Mantiene catálogo base
      });

    return () => {
      mounted = false;
    };
  }, []);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handlePrimaryCta = () => {
    if (user?.role === "technician") {
      go("tech-dashboard");
      return;
    }
    go("tech-register");
  };

  const handleLoginCta = () => {
    if (user?.role === "technician") {
      go("tech-dashboard");
      return;
    }
    go("tech-login");
  };

  return (
    <div className="min-h-screen bg-[#0B1120] text-white selection:bg-[#1D63ED] selection:text-white">
      {/* Franja superior amarilla de seguridad */}
      <div
        className="h-2.5 w-full border-b border-black"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, #FACC15 0px, #FACC15 10px, #0B1120 10px, #0B1120 20px)",
        }}
      />

      {/* NAVBAR SUPERIOR */}
      <header className="sticky top-0 z-30 bg-[#0B1120]/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <button
              type="button"
              onClick={() => go("home")}
              className="text-2xl sm:text-3xl font-black tracking-tight text-white cursor-pointer"
            >
              Fixora
            </button>

            <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-300">
              <button
                type="button"
                onClick={() => scrollToSection("hero-tech")}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Inicio
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("beneficios")}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Beneficios
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("como-funciona")}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Cómo funciona
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("faq")}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Preguntas frecuentes
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("contacto")}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Contacto
              </button>
            </nav>
          </div>

          <div className="hidden sm:flex items-center gap-3">
            <button
              type="button"
              onClick={handleLoginCta}
              className="px-4 py-2 text-sm font-semibold text-slate-200 hover:text-white transition-colors cursor-pointer"
            >
              {user?.role === "technician" ? "Ir a mi Panel" : "Iniciar Sesión"}
            </button>

            <button
              type="button"
              onClick={handlePrimaryCta}
              className="rounded-xl bg-[#1D63ED] hover:bg-blue-600 px-5 py-2.5 text-sm font-bold text-white border-2 border-black shadow-[3px_3px_0px_#FACC15] transition-colors cursor-pointer"
            >
              {user?.role === "technician"
                ? "Panel Técnico"
                : "Registrarme como Técnico"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="lg:hidden p-2 rounded-lg text-slate-300 hover:bg-slate-800"
            aria-label="Abrir menú"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#0F172A] border-b border-slate-800 px-6 py-5 space-y-3">
            <button
              type="button"
              onClick={() => scrollToSection("hero-tech")}
              className="block w-full text-left py-2 text-sm font-medium text-slate-200"
            >
              Inicio
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("beneficios")}
              className="block w-full text-left py-2 text-sm font-medium text-slate-200"
            >
              Beneficios
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("como-funciona")}
              className="block w-full text-left py-2 text-sm font-medium text-slate-200"
            >
              Cómo funciona
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("faq")}
              className="block w-full text-left py-2 text-sm font-medium text-slate-200"
            >
              Preguntas frecuentes
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("contacto")}
              className="block w-full text-left py-2 text-sm font-medium text-slate-200"
            >
              Contacto
            </button>

            <div className="pt-3 border-t border-slate-800 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleLoginCta}
                className="w-full rounded-xl border border-slate-700 py-2.5 text-sm font-semibold text-white"
              >
                Iniciar Sesión
              </button>
              <button
                type="button"
                onClick={handlePrimaryCta}
                className="w-full rounded-xl bg-[#1D63ED] py-2.5 text-sm font-bold text-white"
              >
                Registrarme como Técnico
              </button>
            </div>
          </div>
        )}
      </header>

      {/* HERO PRINCIPAL TÉCNICO */}
      <section
        id="hero-tech"
        className="relative overflow-hidden bg-gradient-to-b from-[#0B1120] via-[#0F182D] to-[#0B1120] pt-12 pb-20 sm:pt-16 sm:pb-24"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#15223B] border border-[#1E335A] px-4 py-1.5 font-mono text-xs font-bold text-[#FACC15]">
              <TrendingUp className="w-3.5 h-3.5" />
              PORTAL DE ESPECIALISTAS • FIXORA
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-extrabold tracking-tight leading-[1.12] text-white">
              Administra tus órdenes y{" "}
              <span className="block text-[#FACC15]">haz crecer tu oficio</span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 max-w-xl leading-relaxed">
              Publica tus especialidades y tarifario, cotiza con clientes y
              controla tu agenda semanal desde el Panel Técnico.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={handlePrimaryCta}
                className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#1D63ED] px-6 py-3.5 text-sm font-bold text-white border-2 border-black shadow-[4px_4px_0px_#FACC15] hover:bg-blue-600 transition-colors cursor-pointer"
              >
                <Users className="w-4 h-4" />
                Registrarme como Técnico
              </button>

              <button
                type="button"
                onClick={handleLoginCta}
                className="inline-flex items-center justify-center rounded-xl border-2 border-slate-700 bg-[#0F172A] px-7 py-3.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Iniciar Sesión
              </button>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => go("home")}
                className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Volver al portal de clientes
              </button>
            </div>
          </div>

          {/* Tarjeta tipo orden técnica + métricas reales */}
          <div className="lg:col-span-6 flex justify-center">
            <div className="w-full max-w-md rounded-2xl bg-[#131C31] border-2 border-[#FACC15] shadow-[8px_8px_0px_#1D63ED] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-dashed border-slate-700 pb-3 font-mono text-xs">
                <span className="font-bold text-[#FACC15]">
                  PANEL OPERATIVO TÉCNICO
                </span>
                <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                  ACTIVO
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[#0B1120] border border-slate-800 p-4">
                  <p className="font-mono text-[10px] uppercase text-slate-400">
                    Especialistas en red
                  </p>
                  <p className="text-2xl font-black text-white mt-1">
                    {registeredTechsCount ? `${registeredTechsCount}` : "24/7"}
                  </p>
                </div>
                <div className="rounded-xl bg-[#0B1120] border border-slate-800 p-4">
                  <p className="font-mono text-[10px] uppercase text-slate-400">
                    Especialidades
                  </p>
                  <p className="text-2xl font-black text-[#FACC15] mt-1">
                    {specialtiesList.length}
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-[#0B1120] border border-dashed border-slate-700 p-4 space-y-2">
                <p className="font-mono text-[11px] font-bold uppercase text-blue-300">
                  Áreas activas en plataforma
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {specialtiesList.slice(0, 6).map((spec) => (
                    <span
                      key={spec}
                      className="font-mono text-[11px] px-2.5 py-1 rounded bg-[#131C31] text-slate-200 border border-slate-700"
                    >
                      {spec}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFICIOS */}
      <section
        id="beneficios"
        className="py-20 bg-[#0F172A] border-t border-slate-800"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <span className="inline-block rounded-full bg-[#15223B] px-3.5 py-1 font-mono text-xs font-bold text-[#FACC15]">
              VENTAJAS PARA ESPECIALISTAS
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-white">
              Herramientas pensadas para tu operación diaria
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl bg-[#131C31] border-2 border-slate-800 p-7">
              <div className="w-12 h-12 rounded-xl bg-[#1D63ED]/20 text-[#FACC15] flex items-center justify-center mb-5">
                <DollarSign className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">
                Tarifario y cotizaciones
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Publica servicios con precio de referencia o envía cotizaciones
                por mensaje antes de aceptar la orden.
              </p>
            </div>

            <div className="rounded-2xl bg-[#131C31] border-2 border-slate-800 p-7">
              <div className="w-12 h-12 rounded-xl bg-[#1D63ED]/20 text-[#FACC15] flex items-center justify-center mb-5">
                <CalendarCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">
                Disponibilidad y agenda
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Configura tus días y horarios de atención, y revisa tus trabajos
                pendientes, aceptados, en proceso y finalizados.
              </p>
            </div>

            <div className="rounded-2xl bg-[#131C31] border-2 border-slate-800 p-7">
              <div className="w-12 h-12 rounded-xl bg-[#1D63ED]/20 text-[#FACC15] flex items-center justify-center mb-5">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">
                Reseñas y comprobantes
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Responde a las calificaciones de tus clientes y consulta el
                comprobante de cada orden completada.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section
        id="como-funciona"
        className="py-20 bg-[#0B1120] border-t border-slate-800"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <span className="inline-block rounded-full bg-[#15223B] px-3.5 py-1 font-mono text-xs font-bold text-[#FACC15]">
              PASO A PASO
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-white">
              Empieza a gestionar tus órdenes en 3 pasos
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl bg-[#131C31] border-2 border-slate-800 p-7">
              <div className="flex items-center justify-between mb-4 font-mono">
                <span className="text-xs font-bold text-[#FACC15]">PASO 01</span>
                <UserPlus className="w-5 h-5 text-[#60A5FA]" />
              </div>
              <h3 className="text-lg font-bold text-white">
                Crea tu perfil técnico
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Registra tus especialidades, zona de cobertura, experiencia y
                servicios en tu tarifario.
              </p>
            </div>

            <div className="rounded-2xl bg-[#131C31] border-2 border-slate-800 p-7">
              <div className="flex items-center justify-between mb-4 font-mono">
                <span className="text-xs font-bold text-[#FACC15]">PASO 02</span>
                <Clock className="w-5 h-5 text-[#60A5FA]" />
              </div>
              <h3 className="text-lg font-bold text-white">
                Define tu horario semanal
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Agrega los bloques de días y horas en los que recibes citas y
                solicitudes.
              </p>
            </div>

            <div className="rounded-2xl bg-[#131C31] border-2 border-slate-800 p-7">
              <div className="flex items-center justify-between mb-4 font-mono">
                <span className="text-xs font-bold text-[#FACC15]">PASO 03</span>
                <CheckCircle2 className="w-5 h-5 text-[#60A5FA]" />
              </div>
              <h3 className="text-lg font-bold text-white">
                Atiende y cierra órdenes
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Acepta solicitudes, inicia el trabajo, márcalo como finalizado y
                responde a las reseñas.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PREGUNTAS FRECUENTES */}
      <section
        id="faq"
        className="py-20 bg-[#0F172A] border-t border-slate-800"
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-8">
          <div className="text-center mb-10">
            <span className="inline-block rounded-full bg-[#15223B] px-3.5 py-1 font-mono text-xs font-bold text-[#FACC15]">
              PREGUNTAS FRECUENTES
            </span>
            <h2 className="mt-3 text-3xl font-extrabold text-white">
              Resuelve tus dudas
            </h2>
          </div>

          <div className="space-y-3">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={item.question}
                  className="rounded-2xl bg-[#131C31] border border-slate-800 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpenFaqIndex((prev) => (prev === idx ? null : idx))
                    }
                    className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <span className="text-sm sm:text-base font-bold text-white">
                      {item.question}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${
                        isOpen ? "rotate-180 text-[#FACC15]" : ""
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-6 pb-5 text-sm text-slate-400 leading-relaxed border-t border-slate-800/70 pt-3">
                      {item.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FOOTER / CONTACTO */}
      <footer
        id="contacto"
        className="bg-[#080D19] border-t border-slate-800 py-14"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <span className="text-2xl font-black text-white">Fixora</span>
            <p className="mt-2 text-sm text-slate-400 max-w-md">
              Plataforma de órdenes de servicio técnico entre clientes y
              especialistas.
            </p>
            <div className="mt-4 flex flex-wrap gap-5 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-[#FACC15]" />
                soporte@fixora.mx
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-[#FACC15]" />
                Soporte a especialistas
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#FACC15]" />
                Ciudad del Carmen, Campeche[cite: 1]
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handlePrimaryCta}
              className="rounded-xl bg-[#1D63ED] hover:bg-blue-600 px-6 py-3 text-sm font-bold text-white border-2 border-black shadow-[3px_3px_0px_#FACC15] transition-colors cursor-pointer"
            >
              Registrarme como Técnico
            </button>
            <button
              type="button"
              onClick={() => go("home")}
              className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Portal de Clientes
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default TechLandingPage;