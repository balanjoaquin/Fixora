import { useId } from "react";
import { AlertCircle } from "lucide-react";

interface InputFieldProps {
  label?: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  rightEl?: React.ReactNode;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  autoComplete?: string;
}

export function InputField({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
  helperText,
  icon,
  rightEl,
  id,
  required,
  disabled,
  min,
  max,
  autoComplete,
}: InputFieldProps) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const errorId = `${fieldId}-error`;
  const helperId = `${fieldId}-helper`;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={fieldId} className="text-sm font-semibold text-[#0F172A]">
          {label}
          {required && (
            <span className="text-red-500 ml-0.5" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div
            aria-hidden="true"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none"
          >
            {icon}
          </div>
        )}
        <input
          id={fieldId}
          type={type}
          placeholder={placeholder}
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full min-h-[44px] ${icon ? "pl-10" : "pl-4"} ${
            rightEl ? "pr-11" : "pr-4"
          } py-2.5 rounded-xl border-2 text-sm transition-all
            ${
              error
                ? "border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                : "border-[#E2E8F0] bg-white focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10"
            }
            text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none disabled:bg-slate-100 disabled:text-slate-500`}
        />
        {rightEl && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
            {rightEl}
          </div>
        )}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-red-600 font-medium flex items-center gap-1">
          <AlertCircle size={12} className="flex-shrink-0" />
          {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className="text-xs text-[#64748B]">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
