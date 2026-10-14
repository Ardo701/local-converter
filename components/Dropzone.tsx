"use client";

import { useCallback, useRef, useState } from "react";
import { acceptAttribute } from "@/lib/registry";
import { useLocale } from "./LocaleProvider";

type Props = {
  onFiles: (files: File[]) => void;
  compact?: boolean;
};

export default function Dropzone({ onFiles, compact = false }: Props) {
  const { t } = useLocale();
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
      className={`cursor-pointer text-center transition-colors duration-100 ${
        dragging ? "bg-accent-soft" : "hover:bg-sunk"
      } ${compact ? "px-5 py-4" : "px-6 py-16"}`}
    >
      {compact ? (
        <p className="label text-muted">
          <span className="text-accent">+</span>&nbsp;&nbsp;
          {t({ fr: "Ajouter des fichiers", en: "Add files" })}
        </p>
      ) : (
        <>
          <svg
            viewBox="0 0 32 32"
            aria-hidden="true"
            className={`mx-auto size-8 ${dragging ? "text-accent" : "text-edge"}`}
          >
            <rect
              x="1"
              y="1"
              width="30"
              height="30"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            <path
              d="M16 10v12M10 16h12"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
          <p className="mt-5 text-[15px]">
            {t({ fr: "Déposez vos fichiers, ou", en: "Drop your files, or" })}{" "}
            <span className="text-accent underline underline-offset-[3px]">
              {t({ fr: "parcourez votre disque", en: "browse your disk" })}
            </span>
            .
          </p>
          <p className="mt-1.5 text-[13px] text-faint">
            {t({
              fr: "Ils sont lus en mémoire. Aucune requête réseau ne les transporte.",
              en: "They are read in memory. No network request ever carries them.",
            })}
          </p>
        </>
      )}
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
