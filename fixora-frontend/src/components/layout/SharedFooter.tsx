import { BrandLogo } from "@/components/common/BrandLogo";
import { useNav } from "@/context/NavigationContext";

export function SharedFooter() {
  const { go, openModal } = useNav();

  return (
    <footer id="contacto" className="bg-[#0F172A] text-white pt-14 pb-8 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-10">
          <div>
            <BrandLogo inverted size="md" />
            <p className="text-sm text-[#94A3B8] leading-relaxed mt-4 max-w-xs">
              Plataforma digital para conectar clientes con técnicos especializados de confianza y seguimiento transparente.
            </p>
          </div>

          <div>
            <h4 className="font-bold mb-4 text-sm text-white">Plataforma</h4>
            <ul className="space-y-2.5 text-sm text-[#94A3B8]">
              <li>
                <button
                  type="button"
                  onClick={() => go("home")}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Portal para Clientes
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => go("tech-landing")}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Portal para Técnicos
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => go("client-register")}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Crear cuenta gratuita
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-4 text-sm text-white">Ayuda y Soporte</h4>
            <ul className="space-y-2.5 text-sm text-[#94A3B8]">
              <li>
                <button
                  type="button"
                  onClick={() => openModal({ type: "info-doc", doc: "support" })}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Centro de ayuda
                </button>
              </li>
              <li>
                <a
                  href="mailto:soporte@fixora.mx"
                  className="hover:text-white transition-colors"
                >
                  soporte@fixora.mx
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-4 text-sm text-white">Legal</h4>
            <ul className="space-y-2.5 text-sm text-[#94A3B8]">
              <li>
                <button
                  type="button"
                  onClick={() => openModal({ type: "info-doc", doc: "privacy" })}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Aviso de privacidad
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => openModal({ type: "info-doc", doc: "terms" })}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Términos y condiciones
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#94A3B8]">
          <p>© {new Date().getFullYear()} Fixora. Todos los derechos reservados.</p>
          <div className="flex gap-5">
            <button
              type="button"
              onClick={() => openModal({ type: "info-doc", doc: "privacy" })}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Privacidad
            </button>
            <button
              type="button"
              onClick={() => openModal({ type: "info-doc", doc: "terms" })}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Términos
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
