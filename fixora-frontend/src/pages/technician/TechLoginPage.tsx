import React, { useState } from "react";
import { ArrowLeft, HardHat, Lock, Mail } from "lucide-react";
import { useNav } from "@/context/NavigationContext";
import {
  extractAuthSession,
  getApiErrorMessage,
  loginUser,
} from "@/services/api";

export function TechLoginPage() {
  const { go, setUser, openModal, showToast } = useNav();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await loginUser({ email: email.trim(), password });
      const { token, user } = extractAuthSession(response.data);

      if (!token || !user) {
        setError("Respuesta de autenticación incompleta del servidor.");
        return;
      }

      if (user.role !== "technician") {
        setError(
          "Esta cuenta está registrada como cliente. Inicia sesión en el acceso de clientes."
        );
        return;
      }

      localStorage.setItem("fixora_token", token);
      setUser(user);
      showToast({
        type: "success",
        title: "Panel técnico listo",
        message: `Hola, ${user.name}.`,
      });
      go("tech-dashboard");
    } catch (err: unknown) {
      setError(
        getApiErrorMessage(err, "Credenciales inválidas o cuenta no disponible.")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1120] bg-blueprint-dark text-white flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full mx-auto">
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
                Portal Técnicos
              </span>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight">
                Iniciar sesión
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="tech-login-email"
                className="block font-mono text-xs font-bold uppercase mb-1.5"
              >
                Correo profesional
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#0B1120]/50 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="tech-login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tecnico@ejemplo.com"
                  className="w-full pl-10 pr-3 py-2.5 bg-white border-2 border-[#0B1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="tech-login-password"
                  className="block font-mono text-xs font-bold uppercase"
                >
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={() =>
                    openModal({ type: "forgot-password", role: "technician" })
                  }
                  className="font-mono text-xs text-blue-700 hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#0B1120]/50 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="tech-login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3 py-2.5 bg-white border-2 border-[#0B1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-[#FACC15] text-[#0B1120] font-mono text-sm font-bold uppercase tracking-wider border-2 border-[#0B1120] shadow-[4px_4px_0px_#0B1120] hover:bg-[#fde047] disabled:opacity-60 transition-colors"
            >
              {loading ? "Verificando..." : "Acceder al tablero"}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t-2 border-dashed border-[#0B1120]/20 flex flex-col gap-2 text-center text-sm">
            <p className="text-[#0B1120]/80">
              ¿Quieres ofrecer tus servicios?{" "}
              <button
                type="button"
                onClick={() => go("tech-register")}
                className="font-bold underline hover:text-blue-700"
              >
                Crear cuenta técnica
              </button>
            </p>
            <p className="text-xs font-mono text-[#0B1120]/70">
              ¿Buscas contratar un servicio?{" "}
              <button
                type="button"
                onClick={() => go("client-login")}
                className="font-bold underline hover:text-[#0B1120]"
              >
                Ir al acceso de clientes
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}