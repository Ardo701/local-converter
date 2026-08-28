"use client";

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
    <div className="grid gap-x-10 gap-y-5 px-5 py-5 sm:grid-cols-2">
      {options.map((option) => {
        const value = values[option.id] ?? option.default;
        return (
          <div key={option.id}>
            <label
              htmlFor={`opt-${option.id}`}
              className="label flex items-baseline justify-between text-faint"
            >
              <span>{option.label}</span>
              {option.type === "range" && (
                <span className="nums text-ink">
                  {value}
                  {option.suffix}
                </span>
              )}
            </label>

            <div className="mt-2">
              {option.type === "select" && (
                <div className="relative">
                  <select
                    id={`opt-${option.id}`}
                    className="field w-full"
                    disabled={disabled}
                    value={String(value)}
                    onChange={(e) => onChange(option.id, e.target.value)}
                  >
                    {option.choices.map((choice) => (
                      <option key={choice.value} value={choice.value}>
                        {choice.label}
                      </option>
                    ))}
                  </select>
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-muted"
                  >
                    ▼
                  </span>
                </div>
              )}

              {option.type === "number" && (
                <div className="flex items-baseline gap-2">
                  <input
                    id={`opt-${option.id}`}
                    type="number"
                    className="field w-full"
                    disabled={disabled}
                    value={Number(value)}
                    min={option.min}
                    max={option.max}
                    step={option.step}
                    onChange={(e) => onChange(option.id, Number(e.target.value))}
                  />
                  {option.suffix && (
                    <span className="shrink-0 font-mono text-[11.5px] text-faint">
                      {option.suffix}
                    </span>
                  )}
                </div>
              )}

              {option.type === "range" && (
                <input
                  id={`opt-${option.id}`}
                  type="range"
                  disabled={disabled}
                  value={Number(value)}
                  min={option.min}
                  max={option.max}
                  step={option.step}
                  onChange={(e) => onChange(option.id, Number(e.target.value))}
                />
              )}

              {option.type === "boolean" && (
                <button
                  id={`opt-${option.id}`}
                  type="button"
                  role="switch"
                  aria-checked={Boolean(value)}
                  disabled={disabled}
                  onClick={() => onChange(option.id, !value)}
                  className="flex items-center gap-2.5 text-[13.5px] disabled:opacity-50"
                >
                  <span
                    aria-hidden="true"
                    className={`flex size-[15px] items-center justify-center border ${
                      value ? "border-accent bg-accent" : "border-edge"
                    }`}
                  >
                    {value && (
                      <svg viewBox="0 0 10 10" className="size-2.5 text-paper">
                        <path
                          d="M1.5 5.2l2.2 2.2L8.5 2.6"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        />
                      </svg>
                    )}
                  </span>
                  {value ? "Activé" : "Désactivé"}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
