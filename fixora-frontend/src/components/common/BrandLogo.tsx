import fixoraLogo from "@/assets/logo-fixora.png";
import { ImageWithFallback } from "./ImageWithFallback";

interface BrandLogoProps {
  inverted?: boolean;
  badge?: string;
  size?: "sm" | "md";
}

export function BrandLogo({ inverted = false, badge, size = "md" }: BrandLogoProps) {
  const heightClass = size === "sm" ? "h-7" : "h-8";
  return (
    <span className="inline-flex items-center gap-2.5">
      <ImageWithFallback
        src={fixoraLogo}
        alt="Fixora"
        className={`${heightClass} w-auto object-contain ${inverted ? "brightness-0 invert" : ""}`}
      />
      {badge && (
        <span
          className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
            inverted
              ? "bg-blue-500/15 text-blue-300 border-blue-400/30"
              : "bg-blue-50 text-blue-700 border-blue-200"
          }`}
        >
          {badge}
        </span>
      )}
    </span>
  );
}
