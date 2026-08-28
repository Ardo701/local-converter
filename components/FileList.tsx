"use client";

import { extOf, humanSize } from "@/lib/utils";

type Props = {
  files: File[];
  onRemove: (index: number) => void;
  disabled?: boolean;
};

export default function FileList({ files, onRemove, disabled }: Props) {
  return (
    <ul>
      {files.map((file, index) => (
        <li
          key={`${file.name}-${index}`}
          className="group flex items-center gap-4 border-b border-rule px-5 py-2.5 last:border-b-0"
        >
          <span className="w-14 shrink-0 font-mono text-[10.5px] uppercase tracking-wider text-accent">
            {extOf(file.name) || "···"}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13.5px]" title={file.name}>
            {file.name}
          </span>
          <span className="nums shrink-0 font-mono text-[11.5px] text-faint">
            {humanSize(file.size)}
          </span>
          <button
            type="button"
            onClick={() => onRemove(index)}
            disabled={disabled}
            aria-label={`Retirer ${file.name}`}
            className="-mr-1.5 shrink-0 px-1.5 text-[13px] leading-none text-faint opacity-0 transition-opacity hover:text-accent focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-30"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}
