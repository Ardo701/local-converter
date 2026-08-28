"use client";

import { Trash2, X } from "lucide-react";
import { CATEGORY_ICONS, categoryOfExtension } from "./icons";
import { CATEGORY_META } from "@/lib/types";
import { extOf, humanSize } from "@/lib/utils";

type Props = {
  files: File[];
  onRemove: (index: number) => void;
  onClear: () => void;
  disabled?: boolean;
};

export default function FileList({ files, onRemove, onClear, disabled }: Props) {
  const total = files.reduce((sum, file) => sum + file.size, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-white/70">
          {files.length} fichier{files.length > 1 ? "s" : ""}
          <span className="ml-2 text-white/35">{humanSize(total)}</span>
        </h3>
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-white/45 transition hover:bg-white/5 hover:text-white/80 disabled:opacity-40"
        >
          <Trash2 className="size-3.5" />
          Tout retirer
        </button>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {files.map((file, index) => {
          const ext = extOf(file.name);
          const category = categoryOfExtension(ext);
          const Icon = category ? CATEGORY_ICONS[category] : null;
          const accent = category ? CATEGORY_META[category].accent : "#64748b";
          return (
            <li
              key={`${file.name}-${index}`}
              className="glass group flex items-center gap-3 rounded-2xl px-3 py-2.5 animate-[rise_0.4s_cubic-bezier(0.16,1,0.3,1)_both]"
              style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
            >
              <div
                className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10"
                style={{ background: `${accent}1f`, color: accent }}
              >
                {Icon ? (
                  <Icon className="size-4" />
                ) : (
                  <span className="text-[10px] font-bold">?</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-white/90" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-white/35">
                  <span className="uppercase">{ext || "sans extension"}</span>
                  <span className="mx-1.5">·</span>
                  {humanSize(file.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(index)}
                disabled={disabled}
                aria-label={`Retirer ${file.name}`}
                className="rounded-lg p-1.5 text-white/30 opacity-0 transition hover:bg-white/10 hover:text-white focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-30"
              >
                <X className="size-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
