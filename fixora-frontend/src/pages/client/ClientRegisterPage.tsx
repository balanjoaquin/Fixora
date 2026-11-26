import React, { useState } from "react";
import { ArrowLeft, UserPlus } from "lucide-react";
import { useNav } from "@/context/NavigationContext";
import {
  extractAuthSession,
  getApiErrorMessage,
  registerUser,
} from "@/services/api";

export function ClientRegisterPage() {
  const { go, setUser, showToast } = useNav();

  const [nombre, setNombre] = useState("");
  const [apellidoP, setApellidoP] = useState("");
  const [apellidoM, setApellidoM] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (password !== passwordConfirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    try {
      const fullName = `${nombre} ${apellidoP} ${apellidoM}`
        .trim()
        .replace(/\s+/g, " ");

      const response = await registerUser({
        name: fullName,
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
        password_confirmation: passwordConfirmation,
        role: "client",
      });

      const { token, user } = extractAuthSession(response.data);

      if (!token || !user) {
        setError("Respuesta de registro incompleta del servidor.");
        return;
      }

      localStorage.setItem("fixora_token", token);
      setUser(user);
      showToast({
        type: "success",
        title: "Cuenta creada",
        message: "Revisa tu correo electrónico para verificar tu cuenta.",
      });
      go("client-dashboard");
    } catch (err: unknown) {
      setError(
        getApiErrorMessage(
          err,
          "No se pudo completar el registro. Verifica tus datos."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] bg-blueprint-light text-[#0B1120] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg mx-auto">
        <button
          type="button"
          onClick={() => go("home")}
          className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[#0B1120]/80 hover:text-[#0B1120] mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al inicio
        </button>

        <div className="bg-white border-2 border-[#0B1120] shadow-[6px_6px_0px_#0B1120] p-6 sm:p-8">
          <div className="flex items-center justify-between border-b-2 border-dashed border-[#0B1120]/20 pb-4 mb-6">
            <div>
              <span className="inline-block bg-[#FACC15] text-[#0B1120] font-mono text-[11px] font-bold uppercase px-2 py-0.5 border border-[#0B1120]">
                Registro Cliente
              </span>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight">
                Crea tu cuenta en Fixora
              </h1>
            </div>
            <div className="w-10 h-10 bg-[#0B1120] text-[#FACC15] flex items-center justify-center border-2 border-[#0B1120]">
              <UserPlus className="w-5 h-5" />
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="reg-nombre"
                className="block font-mono text-xs font-bold uppercase mb-1.5"
              >
                Nombre(s)
              </label>
              <input
                id="reg-nombre"
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Carlos Alberto"
                className="w-full px-3 py-2.5 bg-white border-2 border-[#0B1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="reg-apellido-p"
                  className="block font-mono text-xs font-bold uppercase mb-1.5"
                >
                  Apellido paterno
                </label>
                <input
                  id="reg-apellido-p"
                  type="text"
                  required
                  value={apellidoP}
                  onChange={(e) => setApellidoP(e.target.value)}
                  placeholder="Ej. Méndez"
                  className="w-full px-3 py-2.5 bg-white border-2 border-[#0B1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-apellido-m"
                  className="block font-mono text-xs font-bold uppercase mb-1.5"
                >
                  Apellido materno
                </label>
                <input
                  id="reg-apellido-m"
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
                  htmlFor="reg-email"
                  className="block font-mono text-xs font-bold uppercase mb-1.5"
                >
                  Correo electrónico
                </label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  className="w-full px-3 py-2.5 bg-white border-2 border-[#0B1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-phone"
                  className="block font-mono text-xs font-bold uppercase mb-1.5"
                >
                  Teléfono (10 dígitos)
                </label>
                <input
                  id="reg-phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9381234567"
                  className="w-full px-3 py-2.5 bg-white border-2 border-[#0B1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="reg-password"
                  className="block font-mono text-xs font-bold uppercase mb-1.5"
                >
                  Contraseña
                </label>
                <input
                  id="reg-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mín. 8 caracteres"
                  className="w-full px-3 py-2.5 bg-white border-2 border-[#0B1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-password-confirm"
                  className="block font-mono text-xs font-bold uppercase mb-1.5"
                >
                  Confirmar contraseña
                </label>
                <input
                  id="reg-password-confirm"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  placeholder="Repite contraseña"
                  className="w-full px-3 py-2.5 bg-white border-2 border-[#0B1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-[#0B1120] text-white font-mono text-sm font-bold uppercase tracking-wider border-2 border-[#0B1120] shadow-[4px_4px_0px_#FACC15] hover:bg-[#1E293B] disabled:opacity-60 transition-colors"
            >
              {loading ? "Creando cuenta..." : "Registrarme como cliente"}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t-2 border-dashed border-[#0B1120]/20 text-center text-sm">
            <p className="text-[#0B1120]/80">
              ¿Ya tienes cuenta?{" "}
              <button
                type="button"
                onClick={() => go("client-login")}
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