import { ArrowLeft } from "lucide-react";
import techBadgeImg from "@/assets/tech-badge.png";
import { BrandLogo } from "@/components/common/BrandLogo";
import { ImageWithFallback } from "@/components/common/ImageWithFallback";
import { useNav } from "@/context/NavigationContext";
import type { PageRoute } from "@/types";

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  role?: "client" | "technician";
  backTo?: PageRoute;
  backLabel?: string;
}

export function AuthLayout({
  children,
  title,
  subtitle,
  role = "client",
  backTo,
  backLabel,
}: AuthLayoutProps) {
  const { go } = useNav();
  const isTech = role === "technician";
  const resolvedBackTo: PageRoute = backTo ?? (isTech ? "tech-landing" : "home");
  const resolvedBackLabel =
    backLabel ?? (isTech ? "Volver a portal técnicos" : "Volver al inicio");

  return (
    <div
      className={`min-h-screen flex flex-col ${
        isTech ? "bg-[#0F172A] bg-blueprint-dark" : "bg-[#F8FAFC] bg-blueprint-light"
      }`}
    >
      <header
        className={`px-4 sm:px-6 h-16 flex items-center justify-between border-b ${
          isTech
            ? "border-white/10 bg-[#0F172A]/90 backdrop-blur-md"
            : "border-[#E2E8F0] bg-white/95 backdrop-blur-md"
        }`}
      >
        <button
          type="button"
          onClick={() => go(resolvedBackTo)}
          className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] rounded-lg"
          aria-label="Ir a inicio de Fixora"
        >
          <BrandLogo
            inverted={isTech}
            size="sm"
            badge={isTech ? "Técnicos" : undefined}
          />
        </button>

        <button
          type="button"
          onClick={() => go(resolvedBackTo)}
          className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-3 py-2 rounded-xl transition-colors cursor-pointer ${
            isTech
              ? "text-white/80 hover:text-white hover:bg-white/10"
              : "text-[#475569] hover:text-[#0F172A] hover:bg-slate-100"
          }`}
        >
          <ArrowLeft size={15} />
          <span>{resolvedBackLabel}</span>
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 py-8 sm:py-12">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-[#E2E8F0] p-6 sm:p-8">
          <div className={`mb-7 ${isTech ? "flex items-center gap-3.5" : "text-center"}`}>
            {isTech && (
              <div className="w-12 h-12 rounded-2xl bg-[#EFF6FF] border border-[#DBEAFE] flex items-center justify-center flex-shrink-0">
                <ImageWithFallback
                  src={techBadgeImg}
                  alt="Icono Técnico Fixora"
                  className="w-8 h-8 object-contain"
                />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-extrabold text-[#0F172A] mb-1">{title}</h1>
              <p className="text-sm text-[#475569]">{subtitle}</p>
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
