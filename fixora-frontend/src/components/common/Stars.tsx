import { Star } from "lucide-react";

export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  const clamped = Math.max(0, Math.min(5, rating));
  return (
    <div
      className="inline-flex items-center gap-0.5"
      aria-label={`Calificación de ${clamped} de 5 estrellas`}
    >
      {[1, 2, 3, 4, 5].map((index) => (
        <Star
          key={index}
          size={size}
          aria-hidden="true"
          className={
            index <= Math.round(clamped)
              ? "fill-amber-400 text-amber-400"
              : "fill-slate-200 text-slate-200"
          }
        />
      ))}
    </div>
  );
}
