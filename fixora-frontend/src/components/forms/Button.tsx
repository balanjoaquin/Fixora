import { Loader2 } from "lucide-react";

export interface ButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "light-outline";
  size?: "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  loading?: boolean;
  ariaLabel?: string;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  onClick,
  type = "button",
  disabled = false,
  loading = false,
  ariaLabel,
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none";

  const sizes = {
    sm: "min-h-[38px] px-3.5 py-2 text-xs sm:text-sm",
    md: "min-h-[44px] px-5 py-2.5 text-sm",
    lg: "min-h-[48px] px-6 py-3 text-sm sm:text-base",
  };

  const variants = {
    primary:
      "bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.99] text-white shadow-sm shadow-blue-600/20",
    secondary:
      "bg-[#F1F5F9] hover:bg-[#E2E8F0] active:scale-[0.99] text-[#0F172A] border border-[#E2E8F0]",
    outline:
      "border-2 border-[#2563EB] text-[#2563EB] hover:bg-[#EFF6FF] active:scale-[0.99]",
    "light-outline":
      "border-2 border-white/30 text-white hover:bg-white/10 active:scale-[0.99]",
    ghost:
      "text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A]",
    danger:
      "bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading}
      aria-label={ariaLabel}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
