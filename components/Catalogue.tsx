"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { converters, sourceLabel } from "@/lib/registry";
import { CATEGORY_META, type Category } from "@/lib/types";
import { CATEGORY_ICONS } from "./icons";

const CATEGORIES = Object.keys(CATEGORY_META) as Category[];

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

  return (
    <section id="catalogue" className="mx-auto w-full max-w-6xl px-5 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {converters.length} conversions,{" "}
          <span className="text-gradient">zéro serveur</span>
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-white/45">
          Chaque conversion s&apos;exécute avec WebAssembly, l&apos;élément
          Canvas, la Web Audio API ou une bibliothèque JavaScript spécialisée,
          directement dans l&apos;onglet.
        </p>
      </div>

      <div className="mt-10 flex flex-col gap-4">
        <div className="relative mx-auto w-full max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un format : pdf, heic, mp4, woff2…"
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-brand-400/50 focus:bg-white/[0.07] focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
              category === "all"
                ? "border-white/25 bg-white/12 text-white"
                : "border-white/8 text-white/45 hover:border-white/20 hover:text-white/80"
            }`}
          >
            Tout
          </button>
          {CATEGORIES.map((key) => {
            const meta = CATEGORY_META[key];
            const Icon = CATEGORY_ICONS[key];
            const active = category === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                  active
                    ? "border-white/25 bg-white/12 text-white"
                    : "border-white/8 text-white/45 hover:border-white/20 hover:text-white/80"
                }`}
              >
                <Icon
                  className="size-3.5"
                  style={{ color: active ? meta.accent : undefined }}
                />
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((converter) => {
          const meta = CATEGORY_META[converter.category];
          const Icon = CATEGORY_ICONS[converter.category];
          return (
            <article
              key={converter.id}
              className="glass group rounded-2xl p-4 transition duration-300 hover:-translate-y-0.5 hover:border-white/20"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="flex size-8 items-center justify-center rounded-xl border border-white/10"
                  style={{ background: `${meta.accent}1f`, color: meta.accent }}
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {converter.to}
                  </p>
                  <p className="truncate text-[11px] uppercase tracking-wide text-white/30">
                    depuis {sourceLabel(converter)}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-white/45">
                {converter.description}
              </p>
            </article>
          );
        })}
      </div>

      {!filtered.length && (
        <p className="mt-12 text-center text-sm text-white/40">
          Aucune conversion ne correspond à « {query} ».
        </p>
      )}
    </section>
  );
}
