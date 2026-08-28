"use client";

import { Settings2 } from "lucide-react";
import type { OptionDef } from "@/lib/types";

type Props = {
  options: OptionDef[];
  values: Record<string, string | number | boolean>;
  onChange: (id: string, value: string | number | boolean) => void;
  disabled?: boolean;
};

export default function OptionsPanel({
  options,
  values,
  onChange,
  disabled,
}: Props) {
  if (!options.length) return null;

  return (
    <div className="glass rounded-2xl p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <Settings2 className="size-3.5 text-white/40" />
        <span className="text-xs font-medium uppercase tracking-wider text-white/40">
          Réglages
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {options.map((option) => {
          const value = values[option.id] ?? option.default;
          return (
            <label key={option.id} className="block">
              <span className="mb-1.5 flex items-center justify-between text-xs text-white/55">
                {option.label}
                {option.type === "range" && (
                  <span className="font-mono text-white/80">
                    {value}
                    {option.suffix}
                  </span>
                )}
              </span>

              {option.type === "select" && (
                <select
                  disabled={disabled}
                  value={String(value)}
                  onChange={(e) => onChange(option.id, e.target.value)}
                  className="w-full appearance-none rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white outline-none transition focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/25 disabled:opacity-50"
                >
                  {option.choices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              )}

              {option.type === "number" && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    disabled={disabled}
                    value={Number(value)}
                    min={option.min}
                    max={option.max}
                    step={option.step}
                    onChange={(e) => onChange(option.id, Number(e.target.value))}
                    className="w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white outline-none transition focus:border-brand-400/60 focus:ring-2 focus:ring-brand-500/25 disabled:opacity-50"
                  />
                  {option.suffix && (
                    <span className="text-xs text-white/40">{option.suffix}</span>
                  )}
                </div>
              )}

              {option.type === "range" && (
                <input
                  type="range"
                  disabled={disabled}
                  value={Number(value)}
                  min={option.min}
                  max={option.max}
                  step={option.step}
                  onChange={(e) => onChange(option.id, Number(e.target.value))}
                  className="w-full disabled:opacity-50"
                />
              )}

              {option.type === "boolean" && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(value)}
                  disabled={disabled}
                  onClick={() => onChange(option.id, !value)}
                  className={`relative h-6 w-11 rounded-full border transition disabled:opacity-50 ${
                    value
                      ? "border-brand-400/50 bg-brand-500"
                      : "border-white/12 bg-white/10"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 size-4.5 rounded-full bg-white transition-all ${
                      value ? "left-[1.4rem]" : "left-0.5"
                    }`}
                    style={{ width: "1.125rem", height: "1.125rem" }}
                  />
                </button>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}
