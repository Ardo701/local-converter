"use client";

import type { Category, Converter } from "@/lib/types";
import { CATEGORY_META, CATEGORY_ORDER } from "@/lib/types";

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
      <p className="px-5 py-8 text-center text-[13.5px] text-muted">
        Rien ne couvre cette combinaison de fichiers. Retirez-en, ou n’en gardez
        que d’un même type.
      </p>
    );
  }

  const grouped = converters.reduce<Partial<Record<Category, Converter[]>>>(
    (acc, converter) => {
      (acc[converter.category] ??= []).push(converter);
      return acc;
    },
    {},
  );

  return (
    <div role="radiogroup" aria-label="Format de sortie">
      {CATEGORY_ORDER.filter((category) => grouped[category]).map((category) => (
        <section key={category}>
          <h3 className="label border-b border-rule bg-sunk px-5 py-1.5 text-faint">
            {CATEGORY_META[category].label}
          </h3>
          {grouped[category]!.map((converter) => {
            const active = converter.id === selectedId;
            return (
              <button
                key={converter.id}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                onClick={() => onSelect(converter.id)}
                className={`flex w-full items-baseline gap-4 border-b border-rule px-5 py-2.5 text-left transition-colors duration-100 last:border-b-0 disabled:cursor-not-allowed disabled:opacity-50 ${
                  active ? "bg-accent-soft" : "hover:bg-sunk"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-[5px] size-[9px] shrink-0 border ${
                    active
                      ? "border-accent bg-accent"
                      : "border-edge bg-transparent"
                  }`}
                />
                <span
                  className={`w-44 shrink-0 text-[13.5px] leading-snug ${
                    active ? "font-medium text-accent" : ""
                  }`}
                >
                  {converter.to}
                </span>
                <span className="hidden flex-1 text-[13px] leading-snug text-muted sm:block">
                  {converter.description}
                </span>
                {converter.heavy && (
                  <span className="ml-auto shrink-0 font-mono text-[10px] uppercase tracking-wider text-faint">
                    wasm
                  </span>
                )}
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}
