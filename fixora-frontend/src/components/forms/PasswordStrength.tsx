import { Check } from "lucide-react";

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;

  const checks = [
    { label: "8+ caracteres", passed: password.length >= 8 },
    { label: "Una mayúscula", passed: /[A-Z]/.test(password) },
    { label: "Un número", passed: /[0-9]/.test(password) },
    { label: "Un símbolo", passed: /[^A-Za-z0-9]/.test(password) },
  ];

  const score = checks.filter((c) => c.passed).length;
  const labels = ["", "Débil", "Regular", "Buena", "Segura"];
  const bars = ["", "bg-red-500", "bg-amber-400", "bg-blue-500", "bg-emerald-500"];
  const texts = ["", "text-red-600", "text-amber-600", "text-blue-600", "text-emerald-600"];

  return (
    <div className="mt-2 space-y-2" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1 flex-1">
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                step <= score ? bars[score] : "bg-slate-200"
              }`}
            />
          ))}
        </div>
        <span className={`text-xs font-semibold ${texts[score]}`}>
          {labels[score]}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {checks.map((item) => (
          <span
            key={item.label}
            className={`inline-flex items-center gap-1 text-[11px] ${
              item.passed ? "text-emerald-700 font-medium" : "text-[#64748B]"
            }`}
          >
            <Check
              size={11}
              className={item.passed ? "text-emerald-600" : "text-slate-300"}
            />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
