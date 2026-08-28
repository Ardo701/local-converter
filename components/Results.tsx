"use client";

import { useState } from "react";
import type { OutFile } from "@/lib/types";
import { download, downloadAllAsZip, humanSize } from "@/lib/utils";

type Props = {
  results: OutFile[];
  onReset: () => void;
};

export default function Results({ results, onReset }: Props) {
  const [zipping, setZipping] = useState(false);
  const total = results.reduce((sum, file) => sum + file.blob.size, 0);

  return (
    <div className="border-t border-edge">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-rule bg-sunk px-5 py-2.5">
        <h2 className="label text-accent">
          Résultat — {results.length} fichier{results.length > 1 ? "s" : ""},{" "}
          <span className="nums">{humanSize(total)}</span>
        </h2>
        <div className="flex items-baseline gap-5 text-[12.5px]">
          {results.length > 1 && (
            <button
              type="button"
              disabled={zipping}
              onClick={async () => {
                setZipping(true);
                try {
                  await downloadAllAsZip(results);
                } finally {
                  setZipping(false);
                }
              }}
              className="text-accent underline underline-offset-[3px] disabled:opacity-50"
            >
              {zipping ? "Compression…" : "Tout récupérer (.zip)"}
            </button>
          )}
          <button
            type="button"
            onClick={onReset}
            className="text-muted underline underline-offset-[3px] hover:text-ink"
          >
            Recommencer
          </button>
        </div>
      </div>

      <ul className="max-h-[22rem] overflow-y-auto">
        {results.map((file, index) => (
          <li
            key={`${file.name}-${index}`}
            className="flex items-baseline gap-4 border-b border-rule px-5 py-2.5 last:border-b-0"
          >
            <span className="nums w-7 shrink-0 font-mono text-[11px] text-faint">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13.5px]" title={file.name}>
              {file.name}
            </span>
            <span className="nums shrink-0 font-mono text-[11.5px] text-faint">
              {humanSize(file.blob.size)}
            </span>
            <button
              type="button"
              onClick={() => download(file.blob, file.name)}
              className="shrink-0 text-[12.5px] text-accent underline underline-offset-[3px]"
            >
              Télécharger
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
