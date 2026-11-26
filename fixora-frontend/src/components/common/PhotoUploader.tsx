import React, { useEffect, useMemo, useRef } from "react";
import { Camera, ImagePlus, Trash2 } from "lucide-react";

interface PhotoUploaderProps {
  label: string;
  helperText?: string;
  files: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
  maxSizeMb?: number;
  onError?: (message: string) => void;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function PhotoUploader({
  label,
  helperText = "Opcional • JPG, PNG o WEBP (máx. 4 MB por foto)",
  files,
  onChange,
  maxFiles = 4,
  maxSizeMb = 4,
  onError,
}: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const previews = useMemo(
    () =>
      files.map((file) => ({
        file,
        url: URL.createObjectURL(file),
      })),
    [files]
  );

  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [previews]);

  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;

    const remainingSlots = maxFiles - files.length;
    if (remainingSlots <= 0) {
      onError?.(`Solo puedes subir hasta ${maxFiles} fotos.`);
      e.target.value = "";
      return;
    }

    const validFiles: File[] = [];
    for (const file of selected.slice(0, remainingSlots)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        onError?.(`"${file.name}" no es una imagen válida (usa JPG, PNG o WEBP).`);
        continue;
      }
      if (file.size > maxSizeMb * 1024 * 1024) {
        onError?.(`"${file.name}" supera el límite de ${maxSizeMb} MB.`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      onChange([...files, ...validFiles]);
    }
    e.target.value = "";
  };

  const handleRemove = (indexToRemove: number) => {
    onChange(files.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-extrabold text-[#0F172A] flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-[#1D63ED]" />
          {label}
        </label>
        <span className="font-mono text-[11px] font-bold text-slate-500">
          {files.length}/{maxFiles} fotos
        </span>
      </div>

      {/* Zona de carga */}
      {files.length < maxFiles && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-xl border-2 border-dashed border-slate-300 hover:border-[#1D63ED] bg-[#F8FAFC] hover:bg-blue-50/40 px-4 py-4 flex flex-col items-center justify-center text-center transition-colors cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-[#1D63ED] flex items-center justify-center mb-1.5">
            <ImagePlus className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-[#0F172A]">
            Haz clic para adjuntar fotos
          </span>
          <span className="font-mono text-[11px] text-slate-500 mt-0.5">
            {helperText}
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={handleSelectFiles}
        className="hidden"
      />

      {/* Vista previa de imágenes seleccionadas */}
      {previews.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          {previews.map((item, idx) => (
            <div
              key={`${item.file.name}-${idx}`}
              className="group relative aspect-square rounded-xl border-2 border-[#0F172A] bg-white overflow-hidden shadow-[2px_2px_0px_#0F172A]"
            >
              <img
                src={item.url}
                alt={`Evidencia ${idx + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                aria-label={`Quitar foto ${idx + 1}`}
                className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-[#0B1120]/85 text-white hover:bg-red-600 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PhotoUploader;