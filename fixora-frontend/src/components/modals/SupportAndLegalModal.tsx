import { X } from "lucide-react";
import { Button } from "@/components/forms/Button";
import { useNav } from "@/context/NavigationContext";

const DOC_CONTENT = {
  privacy: {
    title: "Aviso de Privacidad",
    body: [
      "Fixora protege los datos personales proporcionados por clientes y técnicos registrados, utilizándolos exclusivamente para gestionar solicitudes de servicio, validación de perfiles profesionales y comunicación operativa.",
      "Puedes actualizar o solicitar la eliminación de tu información desde la sección 'Configuración' de tu panel en cualquier momento.",
    ],
  },
  terms: {
    title: "Términos y Condiciones de Uso",
    body: [
      "Fixora actúa como plataforma tecnológica de intermediación entre usuarios que requieren mantenimiento o reparación y técnicos independientes verificados.",
      "Cada solicitud genera un folio de seguimiento con estado trazable desde su creación hasta su cierre.",
    ],
  },
  support: {
    title: "Centro de Ayuda Fixora",
    body: [
      "¿Necesitas asistencia con una orden de servicio o con la verificación de tu perfil técnico? Escríbenos a soporte@fixora.mx indicando tu folio de solicitud.",
      "Horario de atención operativa: Lunes a Sábado de 08:00 a 20:00 hrs.",
    ],
  },
};

export function SupportAndLegalModal({ doc }: { doc: "privacy" | "terms" | "support" }) {
  const { closeModal } = useNav();
  const current = DOC_CONTENT[doc];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="info-doc-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={closeModal}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-[#E2E8F0]">
          <h2 id="info-doc-title" className="text-lg font-extrabold text-[#0F172A]">
            {current.title}
          </h2>
          <button
            type="button"
            onClick={closeModal}
            aria-label="Cerrar ventana"
            className="p-1.5 rounded-lg text-[#64748B] hover:bg-slate-100 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 text-sm text-[#475569] leading-relaxed mb-6">
          {current.body.map((paragraph, idx) => (
            <p key={idx}>{paragraph}</p>
          ))}
        </div>
        <div className="flex justify-end">
          <Button variant="primary" onClick={closeModal}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
