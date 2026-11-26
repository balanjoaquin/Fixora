import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, HardHat } from "lucide-react";
import { useNav } from "@/context/NavigationContext";
import api, {
  extractAuthSession,
  getApiErrorMessage,
  registerUser,
  syncTechnicianSpecialties,
  updateTechnicianProfile,
} from "@/services/api";

interface SpecialtyOption {
  id: number;
  name: string;
}

const FALLBACK_SPECIALTIES: SpecialtyOption[] = [
  { id: 1, name: "Electricidad" },
  { id: 2, name: "Plomería" },
  { id: 3, name: "Aire Acondicionado y Refrigeración" },
  { id: 4, name: "Carpintería" },
  { id: 5, name: "Cerrajería" },
  { id: 6, name: "Albañilería y Pintura" },
];

export function TechRegisterPage() {
  const { go, setUser, showToast } = useNav();

  const [specialties, setSpecialties] =
    useState<SpecialtyOption[]>(FALLBACK_SPECIALTIES);

  // Datos de cuenta
  const [nombre, setNombre] = useState("");
  const [apellidoP, setApellidoP] = useState("");
  const [apellidoM, setApellidoM] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");

  // Datos de perfil técnico
  const [specialtyName, setSpecialtyName] = useState<string>("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [serviceZone, setServiceZone] = useState("");
  const [yearsExperience, setYearsExperience] = useState<string>("1");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Evita re-registrar el usuario si falla el paso 2 (perfil/especialidad) y reintenta
  const accountCreatedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await api.get("/specialties");
        const list = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.data)
            ? res.data.data
            : null;
        if (isMounted && list && list.length > 0) {
          setSpecialties(list);
        }
      } catch {
        // Conserva FALLBACK_SPECIALTIES como sugerencias
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const cleanSpecialty = specialtyName.trim();
    if (!cleanSpecialty) {
      setError("Escribe o selecciona tu especialidad principal.");
      return;
    }

    if (!accountCreatedRef.current && password !== passwordConfirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    try {
      if (!accountCreatedRef.current) {
        const fullName = `${nombre} ${apellidoP} ${apellidoM}`
          .trim()
          .replace(/\s+/g, " ");

        const response = await registerUser({
          name: fullName,
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          password,
          password_confirmation: passwordConfirmation,
          role: "technician",
        });

        const { token, user } = extractAuthSession(response.data);

        if (!token || !user) {
          setError("Respuesta de registro incompleta del servidor.");
          return;
        }

        localStorage.setItem("fixora_token", token);
        setUser(user);
        accountCreatedRef.current = true;
      }

      const matched = specialties.find(
        (s) => s.name.toLowerCase() === cleanSpecialty.toLowerCase()
      );

      if (matched) {
        await syncTechnicianSpecialties({ specialty_ids: [matched.id] });
      } else {
        await syncTechnicianSpecialties({ specialties: [cleanSpecialty] });
      }

      await updateTechnicianProfile({
        headline: headline.trim(),
        bio: bio.trim(),
        service_zone: serviceZone.trim(),
        years_experience: Number(yearsExperience),
      });

      showToast({
        type: "success",
        title: "Perfil técnico creado",
        message: "Verifica tu correo y configura tus horarios para hacerte visible.",
      });
      go("tech-dashboard");
    } catch (err: unknown) {
      setError(
        getApiErrorMessage(err, "No se pudo completar el registro técnico.")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1120] bg-blueprint-dark text-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <button
          type="button"
          onClick={() => go("tech-landing")}
          className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-slate-300 hover:text-[#FACC15] mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al portal técnico
        </button>

        <div className="bg-white text-[#0B1120] border-2 border-[#0B1120] shadow-[6px_6px_0px_#FACC15] p-6 sm:p-8">
          <div className="flex items-center justify-between border-b-2 border-dashed border-[#0B1120]/20 pb-4 mb-6">
            <div>
              <span className="inline-block bg-[#0B1120] text-[#FACC15] font-mono text-[11px] font-bold uppercase px-2 py-0.5">
                Alta de Especialista
              </span>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight">
                Registro para Técnicos
              </h1>
            </div>
            <div className="w-10 h-10 bg-[#FACC15] text-[#0B1120] flex items-center justify-center border-2 border-[#0B1120]">
              <HardHat className="w-5 h-5" />
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 p-3 bg-red-50 border-2 border-red-600 text-red-800 text-sm font-medium"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <fieldset
              disabled={accountCreatedRef.current}
              className="space-y-4 disabled:opacity-70"
            >
              <legend className="font-mono text-xs font-bold uppercase text-blue-900 border-b border-[#0B1120]/20 w-full pb-1">
                1. Datos de acceso
              </legend>

              <div>
                <label
                  htmlFor="tech-nombre"
                  className="block font-mono text-xs font-bold uppercase mb-1.5"
                >
                  Nombre(s)
                </label>
                <input
                  id="tech-nombre"
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Luis Fernando"
                  className="w-full px-3 py-2.5 bg-white border-2 border-[#0B1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="tech-apellido-p"
                    className="block font-mono text-xs font-bold uppercase mb-1.5"
                  >
                    Apellido paterno
                  </label>
                  <input
                    id="tech-apellido-p"
                    type="text"
                    required
                    value={apellidoP}
                    onChange={(e) => setApellidoP(e.target.value)}
                    placeholder="Ej. Hernández"
                    className="w-full px-3 py-2.5 bg-white border-2 border-[#0B1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="tech-apellido-m"
                    className="block font-mono text-xs font-bold uppercase mb-1.5"
                  >
                    Apellido materno
                  </label>
                  <input
                    id="tech-apellido-m"
                    type="text"
                    value={apellidoM}
                    onChange={(e) => setApellidoM(e.target.value)}
                    placeholder="Opcional"
                    className="w-full px-3 py-2.5 bg-white border-2 border-[#0B1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="tech-email"
                    className="block font-mono text-xs font-bold uppercase mb-1.5"
                  >
                    Correo electrónico
                  </label>
                  <input
                    id="tech-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tecnico@ejemplo.com"
                    className="w-full px-3 py-2.5 bg-white border-2 border-[#0B1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="tech-phone"
                    className="block font-mono text-xs font-bold uppercase mb-1.5"
                  >
                    Teléfono (10 dígitos)
                  </label>
                  <input
                    id="tech-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9389998877"
                    className="w-full px-3 py-2.5 bg-white border-2 border-[#0B1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="tech-password"
                    className="block font-mono text-xs font-bold uppercase mb-1.5"
                  >
                    Contraseña
                  </label>
                  <input
                    id="tech-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mín. 8 caracteres"
                    className="w-full px-3 py-2.5 bg-white border-2 border-[#0B1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="tech-password-confirm"
                    className="block font-mono text-xs font-bold uppercase mb-1.5"
                  >
                    Confirmar contraseña
                  </label>
                  <input
                    id="tech-password-confirm"
                    type="password"
                    required
                    value={passwordConfirmation}
                    onChange={(e) => setPasswordConfirmation(e.target.value)}
                    placeholder="Repite contraseña"
                    className="w-full px-3 py-2.5 bg-white border-2 border-[#0B1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
                  />
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-4 pt-2">
              <legend className="font-mono text-xs font-bold uppercase text-blue-900 border-b border-[#0B1120]/20 w-full pb-1">
                2. Perfil profesional inicial
              </legend>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="tech-specialty"
                    className="block font-mono text-xs font-bold uppercase mb-1.5"
                  >
                    Especialidad principal
                  </label>
                  <input
                    id="tech-specialty"
                    type="text"
                    list="tech-specialties-list"
                    required
                    value={specialtyName}
                    onChange={(e) => setSpecialtyName(e.target.value)}
                    placeholder="Elige o escribe cualquiera..."
                    className="w-full px-3 py-2.5 bg-white border-2 border-[#0B1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
                  />
                  <datalist id="tech-specialties-list">
                    {specialties.map((spec) => (
                      <option key={spec.id} value={spec.name} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label
                    htmlFor="tech-years"
                    className="block font-mono text-xs font-bold uppercase mb-1.5"
                  >
                    Años de experiencia
                  </label>
                  <input
                    id="tech-years"
                    type="number"
                    min={0}
                    max={60}
                    required
                    value={yearsExperience}
                    onChange={(e) => setYearsExperience(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border-2 border-[#0B1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="tech-headline"
                    className="block font-mono text-xs font-bold uppercase mb-1.5"
                  >
                    Título profesional
                  </label>
                  <input
                    id="tech-headline"
                    type="text"
                    required
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="Ej. Técnico en aire acondicionado"
                    className="w-full px-3 py-2.5 bg-white border-2 border-[#0B1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="tech-zone"
                    className="block font-mono text-xs font-bold uppercase mb-1.5"
                  >
                    Zona de cobertura
                  </label>
                  <input
                    id="tech-zone"
                    type="text"
                    required
                    value={serviceZone}
                    onChange={(e) => setServiceZone(e.target.value)}
                    placeholder="Ej. Playa Norte / Centro"
                    className="w-full px-3 py-2.5 bg-white border-2 border-[#0B1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="tech-bio"
                  className="block font-mono text-xs font-bold uppercase mb-1.5"
                >
                  Descripción breve de experiencia
                </label>
                <textarea
                  id="tech-bio"
                  rows={3}
                  required
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Describe los trabajos que realizas, certificaciones o garantías..."
                  className="w-full px-3 py-2.5 bg-white border-2 border-[#0B1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
                />
              </div>
            </fieldset>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-[#FACC15] text-[#0B1120] font-mono text-sm font-bold uppercase tracking-wider border-2 border-[#0B1120] shadow-[4px_4px_0px_#0B1120] hover:bg-[#fde047] disabled:opacity-60 transition-colors"
            >
              {loading
                ? "Configurando cuenta técnica..."
                : "Completar registro técnico"}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t-2 border-dashed border-[#0B1120]/20 text-center text-sm">
            <p className="text-[#0B1120]/80">
              ¿Ya tienes cuenta técnica?{" "}
              <button
                type="button"
                onClick={() => go("tech-login")}
                className="font-bold underline hover:text-blue-700"
              >
                Inicia sesión aquí
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}