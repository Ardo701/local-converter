"use client";

import { Check, Zap } from "lucide-react";
import type { Category, Converter } from "@/lib/types";
import { CATEGORY_META } from "@/lib/types";
import { CATEGORY_ICONS } from "./icons";

type Props = {
  converters: Converter[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
};

export default function TargetPicker({
  converters,
  selectedId,
  onSelect,
  disabled,
}: Props) {
  if (!converters.length) {
    return (
      <div className="glass rounded-2xl px-5 py-8 text-center">
        <p className="text-sm text-white/60">
          Aucune conversion ne couvre cette combinaison de fichiers.
        </p>
        <p className="mt-1 text-xs text-white/35">
          Essayez de ne sélectionner que des fichiers du même type.
        </p>
      </div>
    );
  }

  const grouped = converters.reduce<Record<string, Converter[]>>(
    (acc, converter) => {
      (acc[converter.category] ??= []).push(converter);
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-5">
      {Object.entries(grouped).map(([category, list]) => {
        const meta = CATEGORY_META[category as Category];
        const Icon = CATEGORY_ICONS[category as Category];
        return (
          <div key={category}>
            <div className="mb-2.5 flex items-center gap-2">
              <Icon className="size-3.5" style={{ color: meta.accent }} />
              <span className="text-xs font-medium uppercase tracking-wider text-white/40">
                {meta.label}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((converter) => {
                const active = converter.id === selectedId;
                return (
                  <button
                    key={converter.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelect(converter.id)}
                    className={`group relative overflow-hidden rounded-2xl border px-4 py-3 text-left transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                      active
                        ? "border-transparent bg-white/[0.09] shadow-[0_0_0_1px_rgba(167,139,250,0.7),0_10px_40px_-12px_rgba(139,92,246,0.6)]"
                        : "border-white/8 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.055]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-white">
                        {converter.to}
                      </span>
                      <span
                        className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition ${
                          active
                            ? "border-brand-400 bg-brand-500 text-white"
                            : "border-white/20 text-transparent"
                        }`}
                      >
                        <Check className="size-2.5" strokeWidth={3.5} />
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/45">
                      {converter.description}
                    </p>
                    {converter.heavy && (
                      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-300/90">
                        <Zap className="size-2.5" />
                        moteur Wasm
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
