import { useId } from "react";
import { AlertCircle } from "lucide-react";

interface TextareaFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  helperText?: string;
  rows?: number;
  maxLength?: number;
  id?: string;
  required?: boolean;
}

export function TextareaField({
  label,
  value,
  onChange,
  placeholder,
  error,
  helperText,
  rows = 4,
  maxLength,
  id,
  required,
}: TextareaFieldProps) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const errorId = `${fieldId}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={fieldId} className="text-sm font-semibold text-[#0F172A]">
            {label}
            {required && (
              <span className="text-red-500 ml-0.5" aria-hidden="true">
                *
              </span>
            )}
          </label>
          {maxLength && (
            <span className="text-xs text-[#64748B]">
              {value.length}/{maxLength}
            </span>
          )}
        </div>
      )}
      <textarea
        id={fieldId}
        rows={rows}
        maxLength={maxLength}
        value={value}
        placeholder={placeholder}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-4 py-3 rounded-xl border-2 text-sm resize-y transition-all
          ${
            error
              ? "border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
              : "border-[#E2E8F0] bg-white focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10"
          }
          text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none`}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-red-600 font-medium flex items-center gap-1">
          <AlertCircle size={12} className="flex-shrink-0" />
          {error}
        </p>
      ) : helperText ? (
        <p className="text-xs text-[#64748B]">{helperText}</p>
      ) : null}
    </div>
  );
}
