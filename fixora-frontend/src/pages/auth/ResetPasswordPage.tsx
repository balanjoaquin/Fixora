import React, { useState } from "react";
import { KeyRound, Lock } from "lucide-react";
import { useNav } from "@/context/NavigationContext";
import { getApiErrorMessage, resetPassword } from "@/services/api";

export function ResetPasswordPage() {
  const { go, showToast } = useNav();

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") ?? "";
  const email = params.get("email") ?? "";

  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const missingParams = !token || !email;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (password !== passwordConfirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    try {
      await resetPassword({
        token,
        email,
        password,
        password_confirmation: passwordConfirmation,
      });

      showToast({
        type: "success",
        title: "Contraseña actualizada",
        message: "Ya puedes iniciar sesión con tu nueva contraseña.",
      });
      go("client-login");
    } catch (err: unknown) {
      setError(
        getApiErrorMessage(
          err,
          "El enlace de restablecimiento no es válido o ya expiró."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] bg-blueprint-light text-[#0B1120] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full mx-auto bg-white border-2 border-[#0B1120] shadow-[6px_6px_0px_#0B1120] p-6 sm:p-8">
        <div className="flex items-center justify-between border-b-2 border-dashed border-[#0B1120]/20 pb-4 mb-6">
          <div>
            <span className="inline-block bg-[#FACC15] text-[#0B1120] font-mono text-[11px] font-bold uppercase px-2 py-0.5 border border-[#0B1120]">
              Seguridad
            </span>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight">
              Nueva contraseña
            </h1>
          </div>
          <div className="w-10 h-10 bg-[#0B1120] text-[#FACC15] flex items-center justify-center border-2 border-[#0B1120]">
            <KeyRound className="w-5 h-5" />
          </div>
        </div>

        {missingParams ? (
          <div className="space-y-4">
            <div className="p-3 bg-red-50 border-2 border-red-600 text-red-800 text-sm font-medium">
              El enlace de recuperación está incompleto o es inválido. Solicita
              uno nuevo desde el inicio de sesión.
            </div>
            <button
              type="button"
              onClick={() => go("client-login")}
              className="w-full py-3 px-4 bg-[#0B1120] text-white font-mono text-xs font-bold uppercase tracking-wider border-2 border-[#0B1120]"
            >
              Ir a iniciar sesión
            </button>
          </div>
        ) : (
          <>
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
                <label className="block font-mono text-xs font-bold uppercase mb-1.5">
                  Cuenta
                </label>
                <input
                  type="email"
                  disabled
                  value={email}
                  className="w-full px-3 py-2.5 bg-slate-100 border-2 border-[#0B1120]/40 text-sm text-[#0B1120]/70"
                />
              </div>

              <div>
                <label
                  htmlFor="reset-password"
                  className="block font-mono text-xs font-bold uppercase mb-1.5"
                >
                  Nueva contraseña
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#0B1120]/50 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="reset-password"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mín. 8 caracteres"
                    className="w-full pl-10 pr-3 py-2.5 bg-white border-2 border-[#0B1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="reset-password-confirm"
                  className="block font-mono text-xs font-bold uppercase mb-1.5"
                >
                  Confirmar contraseña
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#0B1120]/50 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="reset-password-confirm"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={passwordConfirmation}
                    onChange={(e) => setPasswordConfirmation(e.target.value)}
                    placeholder="Repite tu nueva contraseña"
                    className="w-full pl-10 pr-3 py-2.5 bg-white border-2 border-[#0B1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-[#0B1120] text-white font-mono text-sm font-bold uppercase tracking-wider border-2 border-[#0B1120] shadow-[4px_4px_0px_#FACC15] hover:bg-[#1E293B] disabled:opacity-60 transition-colors"
              >
                {loading ? "Guardando..." : "Restablecer contraseña"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default ResetPasswordPage;