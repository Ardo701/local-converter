"use client";

import { useState } from "react";
import { Download, FileDown, Package } from "lucide-react";
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
    <div className="glass-strong animate-[rise_0.5s_cubic-bezier(0.16,1,0.3,1)_both] rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-white">
            <span className="flex size-6 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
              <FileDown className="size-3.5" />
            </span>
            {results.length} fichier{results.length > 1 ? "s" : ""} prêt
            {results.length > 1 ? "s" : ""}
          </h3>
          <p className="mt-1 text-xs text-white/40">
            {humanSize(total)} au total — tout a été calculé sur votre machine.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onReset}
            className="rounded-xl border border-white/10 px-3.5 py-2 text-sm text-white/60 transition hover:bg-white/5 hover:text-white"
          >
            Nouvelle conversion
          </button>
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
              className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-ink-950 transition hover:bg-white/90 disabled:opacity-60"
            >
              <Package className="size-4" />
              {zipping ? "Compression…" : "Tout télécharger (.zip)"}
            </button>
          )}
        </div>
      </div>

      <ul className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-1">
        {results.map((file, index) => (
          <li
            key={`${file.name}-${index}`}
            className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-white/90" title={file.name}>
                {file.name}
              </p>
              <p className="text-xs text-white/35">{humanSize(file.blob.size)}</p>
            </div>
            <button
              type="button"
              onClick={() => download(file.blob, file.name)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:border-brand-400/50 hover:bg-brand-500/15 hover:text-white"
            >
              <Download className="size-3.5" />
              Télécharger
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
