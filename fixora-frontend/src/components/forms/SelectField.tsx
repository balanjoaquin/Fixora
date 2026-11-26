import { useId } from "react";
import { AlertCircle, ChevronDown } from "lucide-react";

interface SelectFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  error?: string;
  helperText?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
  helperText,
  id,
  required,
  disabled,
}: SelectFieldProps) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const errorId = `${fieldId}-error`;

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
        <select
          id={fieldId}
          value={value}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full min-h-[44px] pl-4 pr-10 py-2.5 rounded-xl border-2 text-sm appearance-none bg-white transition-all
            ${
              error
                ? "border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                : "border-[#E2E8F0] focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10"
            }
            text-[#0F172A] focus:outline-none disabled:bg-slate-100`}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none"
        />
      </div>
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
