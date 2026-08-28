"use client";

import { useCallback, useRef, useState } from "react";
import { FilePlus2, Upload } from "lucide-react";
import { acceptAttribute } from "@/lib/registry";

type Props = {
  onFiles: (files: File[]) => void;
  compact?: boolean;
};

export default function Dropzone({ onFiles, compact = false }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const depth = useRef(0);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      depth.current = 0;
      setDragging(false);
      const files = Array.from(event.dataTransfer.files ?? []);
      if (files.length) onFiles(files);
    },
    [onFiles],
  );

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        depth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault();
        depth.current -= 1;
        if (depth.current <= 0) setDragging(false);
      }}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      className={`group relative w-full cursor-pointer overflow-hidden rounded-3xl border border-dashed transition-all duration-300 ${
        dragging
          ? "border-brand-400 bg-brand-500/10 scale-[1.01]"
          : "border-white/15 hover:border-white/30 hover:bg-white/[0.03]"
      } ${compact ? "px-5 py-6" : "px-6 py-14 sm:py-20"}`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(600px circle at 50% 0%, rgba(139,92,246,0.16), transparent 70%)",
        }}
      />
      <div className="relative flex flex-col items-center gap-3 text-center">
        <div
          className={`flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-brand-400 transition-transform duration-300 group-hover:-translate-y-0.5 ${
            compact ? "size-10" : "size-16"
          }`}
        >
          {compact ? (
            <FilePlus2 className="size-5" />
          ) : (
            <Upload className="size-7" />
          )}
        </div>
        <div>
          <p
            className={`font-semibold text-white ${compact ? "text-sm" : "text-lg sm:text-xl"}`}
          >
            {compact
              ? "Ajouter d'autres fichiers"
              : "Déposez vos fichiers ici"}
          </p>
          {!compact && (
            <p className="mt-1.5 text-sm text-white/45">
              ou cliquez pour parcourir — vos fichiers ne quittent jamais cet
              onglet
            </p>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={acceptAttribute}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
