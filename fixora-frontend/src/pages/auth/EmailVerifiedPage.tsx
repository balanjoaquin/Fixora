import { useEffect } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { useNav } from "@/context/NavigationContext";
import { getCurrentUser } from "@/services/api";
import type { AuthUser } from "@/types";

export function EmailVerifiedPage() {
  const { go, user, setUser } = useNav();

  const params = new URLSearchParams(window.location.search);
  const status = params.get("status");
  const isSuccess =
    status === "verified" ||
    status === "success" ||
    status === "already_verified";

  useEffect(() => {
    if (!isSuccess || !localStorage.getItem("fixora_token")) return;

    let isMounted = true;
    (async () => {
      try {
        const res = await getCurrentUser();
        const raw = res.data as unknown as Record<string, unknown>;
        const inner =
          raw.data && typeof raw.data === "object"
            ? (raw.data as Record<string, unknown>)
            : raw;
        const freshUser =
          inner.user && typeof inner.user === "object"
            ? (inner.user as AuthUser)
            : (inner as unknown as AuthUser);

        if (isMounted && freshUser?.id) {
          setUser(freshUser);
        }
      } catch {
        // Si no hay sesión activa en esta pestaña, se actualizará al iniciar sesión
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isSuccess, setUser]);

  const handleContinue = () => {
    if (user) {
      go(user.role === "technician" ? "tech-dashboard" : "client-dashboard");
      return;
    }
    go("client-login");
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] bg-blueprint-light text-[#0B1120] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full mx-auto bg-white border-2 border-[#0B1120] shadow-[6px_6px_0px_#0B1120] p-6 sm:p-8 text-center">
        <div className="w-12 h-12 mx-auto flex items-center justify-center border-2 border-[#0B1120] bg-[#FACC15]">
          {isSuccess ? (
            <CheckCircle2 className="w-6 h-6 text-[#0B1120]" />
          ) : (
            <XCircle className="w-6 h-6 text-red-700" />
          )}
        </div>

        <span className="inline-block mt-4 bg-[#0B1120] text-[#FACC15] font-mono text-[11px] font-bold uppercase px-2.5 py-0.5">
          {isSuccess ? "Correo verificado" : "Enlace inválido o expirado"}
        </span>

        <h1 className="mt-3 text-2xl font-extrabold tracking-tight">
          {isSuccess
            ? "¡Tu correo ha sido verificado!"
            : "No se pudo verificar tu correo"}
        </h1>

        <p className="mt-2 text-sm text-[#0B1120]/80">
          {isSuccess
            ? "Tu cuenta ya está activa y habilitada para operar dentro de Fixora."
            : "El enlace de verificación expiró o fue modificado. Inicia sesión para solicitar un nuevo correo de confirmación."}
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleContinue}
            className="w-full py-3 px-4 bg-[#0B1120] text-white font-mono text-xs font-bold uppercase tracking-wider border-2 border-[#0B1120] shadow-[4px_4px_0px_#FACC15] hover:bg-[#1E293B] transition-colors"
          >
            {user ? "Ir a mi panel" : "Iniciar sesión"}
          </button>

          <button
            type="button"
            onClick={() => go("home")}
            className="w-full py-2.5 px-4 bg-white text-[#0B1120] font-mono text-xs font-bold uppercase tracking-wider border-2 border-[#0B1120] hover:bg-slate-100 transition-colors"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
}

export default EmailVerifiedPage;