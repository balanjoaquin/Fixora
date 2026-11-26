import { useState } from "react";
import { Image as ImageIcon, X, ZoomIn } from "lucide-react";

interface PhotoGalleryProps {
  photos?: string[] | null;
  title?: string;
}

function normalizePhotoUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  const storageMatch = trimmed.match(/^(?:https?:\/\/[^/]+)?(\/storage\/.*)$/i);
  if (storageMatch && storageMatch[1]) {
    return storageMatch[1];
  }

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:")
  ) {
    return trimmed;
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function PhotoGallery({
  photos,
  title = "Evidencia fotográfica",
}: PhotoGalleryProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  if (!Array.isArray(photos) || photos.length === 0) {
    return null;
  }

  const resolvedPhotos = photos
    .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
    .map(normalizePhotoUrl);

  if (resolvedPhotos.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 pt-2">
      <p className="font-mono text-[11px] font-bold uppercase text-slate-500 flex items-center gap-1.5">
        <ImageIcon className="w-3.5 h-3.5 text-[#1D63ED]" />
        {title} ({resolvedPhotos.length})
      </p>

      <div className="flex flex-wrap gap-2.5">
        {resolvedPhotos.map((url, idx) => (
          <button
            key={`${url}-${idx}`}
            type="button"
            onClick={() => setSelectedPhoto(url)}
            className="group relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-2 border-[#0F172A] bg-white overflow-hidden shadow-[2px_2px_0px_#0F172A] cursor-pointer"
          >
            <img
              src={url}
              alt={`${title} ${idx + 1}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
            <span className="absolute inset-0 bg-[#0B1120]/0 group-hover:bg-[#0B1120]/35 flex items-center justify-center transition-colors">
              <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </span>
          </button>
        ))}
      </div>

      {/* Visor ampliado (Lightbox) */}
      {selectedPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-3xl w-full bg-[#0B1120] border-2 border-[#FACC15] rounded-2xl overflow-hidden shadow-2xl"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 text-white">
              <span className="font-mono text-xs font-bold text-[#FACC15]">
                {title}
              </span>
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                aria-label="Cerrar imagen"
                className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 flex items-center justify-center bg-black">
              <img
                src={selectedPhoto}
                alt={title}
                className="max-h-[75vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PhotoGallery;