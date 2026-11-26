import React, { useState } from "react";
import { CheckCircle2, KeyRound, Mail, X } from "lucide-react";
import { useNav } from "@/context/NavigationContext";
import { forgotPassword, getApiErrorMessage } from "@/services/api";

interface ForgotPasswordModalProps {
  role: "client" | "technician";
}

export function ForgotPasswordModal({ role }: ForgotPasswordModalProps) {
  const { closeModal, showToast } = useNav();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await forgotPassword(email.trim().toLowerCase());
      setSent(true);
      showToast({
        type: "info",
        title: "Solicitud enviada",
        message: "Si el correo existe, recibirás un enlace de recuperación.",
      });
    } catch (err: unknown) {
      setError(
        getApiErrorMessage(
          err,
          "No se pudo procesar la solicitud. Intenta nuevamente en unos minutos."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1120]/70 p-4"
      onClick={closeModal}
    >
      <div
        className="w-full max-w-md bg-white text-[#0B1120] border-2 border-[#0B1120] shadow-[6px_6px_0px_#FACC15] p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={closeModal}
          aria-label="Cerrar modal"
          className="absolute top-4 right-4 p-1.5 border-2 border-[#0B1120] hover:bg-slate-100"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 border-b-2 border-dashed border-[#0B1120]/20 pb-4 mb-5">
          <div className="w-10 h-10 bg-[#0B1120] text-[#FACC15] flex items-center justify-center border-2 border-[#0B1120]">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <span className="font-mono text-[10px] font-bold uppercase bg-[#FACC15] px-2 py-0.5 border border-[#0B1120]">
              {role === "technician" ? "Cuenta Técnica" : "Cuenta Cliente"}
            </span>
            <h2 className="text-lg font-extrabold mt-1">
              Recuperar contraseña
            </h2>
          </div>
        </div>

        {sent ? (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border-2 border-emerald-700 text-emerald-950 text-sm flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <p>
                Si existe una cuenta activa asociada a{" "}
                <strong className="font-mono">{email}</strong>, te enviamos un
                correo con el enlace para restablecer tu contraseña.
              </p>
            </div>

            <button
              type="button"
              onClick={closeModal}
              className="w-full py-2.5 px-4 bg-[#0B1120] text-white font-mono text-xs font-bold uppercase tracking-wider border-2 border-[#0B1120] hover:bg-[#1E293B]"
            >
              Entendido
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-[#0B1120]/80 mb-4">
              Ingresa el correo registrado en tu cuenta y te enviaremos un
              enlace seguro para crear una nueva contraseña.
            </p>

            {error && (
              <div
                role="alert"
                className="mb-4 p-3 bg-red-50 border-2 border-red-600 text-red-800 text-xs font-medium"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="forgot-email"
                  className="block font-mono text-xs font-bold uppercase mb-1.5"
                >
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#0B1120]/50 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="w-full pl-10 pr-3 py-2.5 bg-white border-2 border-[#0B1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 bg-white text-[#0B1120] font-mono text-xs font-bold uppercase border-2 border-[#0B1120] hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-[#FACC15] text-[#0B1120] font-mono text-xs font-bold uppercase border-2 border-[#0B1120] shadow-[3px_3px_0px_#0B1120] hover:bg-[#fde047] disabled:opacity-60"
                >
                  {loading ? "Enviando..." : "Enviar enlace"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default ForgotPasswordModal;