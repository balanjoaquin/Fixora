import React, { useState } from "react";
import { CheckCircle2, Star, X } from "lucide-react";
import { PhotoUploader } from "@/components/common/PhotoUploader";
import { useNav } from "@/context/NavigationContext";
import { createServiceReview, getApiErrorMessage } from "@/services/api";

export interface ReviewTargetOrder {
  id: number | string;
  folio?: string;
  title?: string;
  technicianName?: string;
}

interface ReviewServiceModalProps {
  order: ReviewTargetOrder | null;
  onClose: () => void;
  onSubmitted?: () => void;
}

export function ReviewServiceModal({
  order,
  onClose,
  onSubmitted,
}: ReviewServiceModalProps) {
  const { showToast } = useNav();

  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);

  if (!order) return null;

  const folioLabel =
    order.folio || `FX-${String(order.id).padStart(4, "0")}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await createServiceReview(order.id, {
        rating,
        comment: comment.trim() || undefined,
        photos,
      });

      showToast({
        type: "success",
        title: "Reseña publicada",
        message:
          photos.length > 0
            ? `Calificación de ${rating}/5 guardada con ${photos.length} foto(s).`
            : `Calificación de ${rating}/5 registrada correctamente.`,
      });

      setComment("");
      setPhotos([]);
      onSubmitted?.();
      onClose();
    } catch (err) {
      showToast({
        type: "error",
        title: "No se pudo guardar la calificación",
        message: getApiErrorMessage(err, "Intenta nuevamente en unos segundos."),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Calificar orden ${folioLabel}`}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#F8FAFC] border-2 border-[#0F172A] shadow-[8px_8px_0px_#0F172A] rounded-2xl overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="bg-[#0B1120] text-white px-5 py-4 flex items-center justify-between gap-3">
          <div>
            <span className="font-mono text-[11px] font-bold px-2.5 py-0.5 rounded bg-[#FACC15] text-[#0F172A]">
              ORDEN {folioLabel}
            </span>
            <h2 className="mt-1.5 text-lg font-black">
              Calificar servicio recibido
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="p-2 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {order.title && (
            <div className="rounded-xl bg-white border border-dashed border-slate-300 p-3 text-xs">
              <span className="font-mono uppercase text-slate-400 block">
                Servicio concluido
              </span>
              <span className="font-extrabold text-[#0F172A]">
                {order.title}
              </span>
              {order.technicianName && (
                <span className="block text-slate-600 mt-0.5">
                  Especialista: <strong>{order.technicianName}</strong>
                </span>
              )}
            </div>
          )}

          {/* Selector de estrellas */}
          <div className="space-y-1.5">
            <label className="block text-xs font-extrabold text-[#0F172A]">
              Tu puntuación *
            </label>
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-3">
              {[1, 2, 3, 4, 5].map((starValue) => {
                const active = (hoverRating || rating) >= starValue;
                return (
                  <button
                    key={starValue}
                    type="button"
                    onMouseEnter={() => setHoverRating(starValue)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(starValue)}
                    aria-label={`${starValue} estrellas`}
                    className="p-1 transition-transform hover:scale-110 cursor-pointer"
                  >
                    <Star
                      className={`w-7 h-7 ${
                        active
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-300"
                      }`}
                    />
                  </button>
                );
              })}
              <span className="ml-auto font-mono text-sm font-black text-[#0F172A]">
                {rating} / 5
              </span>
            </div>
          </div>

          {/* Comentario */}
          <div>
            <label className="block text-xs font-extrabold text-[#0F172A] mb-1">
              Comentario sobre la atención y calidad (opcional)
            </label>
            <textarea
              rows={3}
              maxLength={1000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Comparte cómo fue la puntualidad, limpieza y solución del técnico..."
              className="w-full rounded-xl border-2 border-slate-300 focus:border-[#1D63ED] bg-white px-3.5 py-2 text-xs sm:text-sm text-[#0F172A] focus:outline-none"
            />
          </div>

          {/* FOTOS OPCIONALES DEL TRABAJO TERMINADO */}
          <div className="rounded-xl bg-white border border-slate-200 p-3.5">
            <PhotoUploader
              label="Fotos del trabajo terminado (opcional)"
              helperText="Opcional • Muestra cómo quedó el resultado final (máx. 3 fotos)"
              files={photos}
              onChange={setPhotos}
              maxFiles={3}
              onError={(msg) =>
                showToast({
                  type: "error",
                  title: "Imagen no válida",
                  message: msg,
                })
              }
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1D63ED] hover:bg-blue-700 disabled:opacity-60 text-white px-5 py-2.5 text-xs sm:text-sm font-extrabold border-2 border-[#0F172A] shadow-[3px_3px_0px_#0F172A] cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              {submitting ? "Publicando..." : "Publicar calificación"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ReviewServiceModal;
