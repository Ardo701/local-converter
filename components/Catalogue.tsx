"use client";

import { useMemo, useState } from "react";
import { converters, sourceLabel } from "@/lib/registry";
import { CATEGORY_META, CATEGORY_ORDER, type Category } from "@/lib/types";

export default function Catalogue() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return converters.filter((converter) => {
      if (category !== "all" && converter.category !== category) return false;
      if (!needle) return true;
      return (
        converter.to.toLowerCase().includes(needle) ||
        converter.description.toLowerCase().includes(needle) ||
        converter.from.some((ext) => ext.includes(needle))
      );
    });
  }, [category, query]);

  const groups = CATEGORY_ORDER.map((key) => ({
    key,
    label: CATEGORY_META[key].label,
    items: filtered.filter((converter) => converter.category === key),
  })).filter((group) => group.items.length);

  return (
    <section id="catalogue" className="mx-auto w-full max-w-5xl px-6 py-20">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-b border-edge pb-3">
        <h2 className="display text-[30px] leading-none">Catalogue</h2>
        <div className="flex items-center gap-5">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrer…"
            aria-label="Filtrer les conversions"
            className="field w-44"
          />
          <p className="nums shrink-0 font-mono text-[11.5px] text-faint">
            {filtered.length} / {converters.length}
          </p>
        </div>
      </div>

      <div className="border-b border-rule py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {(["all", ...CATEGORY_ORDER] as const).map((key) => {
            const active = category === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                className={`label pb-0.5 transition-colors duration-100 ${
                  active
                    ? "border-b border-accent text-accent"
                    : "border-b border-transparent text-faint hover:text-ink"
                }`}
              >
                {key === "all" ? "Tout" : CATEGORY_META[key].label}
              </button>
            );
          })}
        </div>
      </div>

      {groups.map((group) => (
        <div key={group.key}>
          <h3 className="label sticky top-0 z-10 border-b border-rule bg-paper py-2 pt-7 text-accent">
            {group.label}
          </h3>
          <table className="w-full border-collapse text-left">
            <tbody>
              {group.items.map((converter) => (
                <tr key={converter.id} className="border-b border-rule align-baseline">
                  <th
                    scope="row"
                    className="w-[11rem] py-2.5 pr-4 text-[13.5px] font-medium"
                  >
                    {converter.to}
                  </th>
                  <td className="w-[11rem] py-2.5 pr-4 font-mono text-[11px] uppercase leading-relaxed tracking-wide text-muted">
                    {sourceLabel(converter)}
                  </td>
                  <td className="hidden py-2.5 text-[13px] leading-snug text-muted md:table-cell">
                    {converter.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {!groups.length && (
        <p className="py-14 text-center text-[13.5px] text-muted">
          Rien ne correspond à « {query} ».
        </p>
      )}
    </section>
  );
}
