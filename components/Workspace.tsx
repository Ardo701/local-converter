"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Dropzone from "./Dropzone";
import FileList from "./FileList";
import OptionsPanel from "./OptionsPanel";
import Results from "./Results";
import TargetPicker from "./TargetPicker";
import { matchingConverters, converterById } from "@/lib/registry";
import type { OutFile } from "@/lib/types";
import { dedupeNames } from "@/lib/utils";

type Status = "idle" | "running" | "done" | "error";

export default function Workspace() {
  const [files, setFiles] = useState<File[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [optionValues, setOptionValues] = useState<
    Record<string, string | number | boolean>
  >({});
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<OutFile[]>([]);
  const resultsRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  const available = useMemo(() => matchingConverters(files), [files]);
  const selected = selectedId ? (converterById.get(selectedId) ?? null) : null;

  // Keep the selection valid whenever the file set changes.
  useEffect(() => {
    if (!available.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) => {
      if (current && available.some((c) => c.id === current)) return current;
      return available[0].id;
    });
  }, [available]);

  // Reset option values to the selected converter's defaults.
  useEffect(() => {
    if (!selected?.options) {
      setOptionValues({});
      return;
    }
    const defaults: Record<string, string | number | boolean> = {};
    for (const option of selected.options) defaults[option.id] = option.default;
    setOptionValues(defaults);
  }, [selected]);

  const addFiles = useCallback((incoming: File[]) => {
    setResults([]);
    setError(null);
    setStatus("idle");
    setFiles((current) => {
      const known = new Set(current.map((f) => `${f.name}:${f.size}`));
      const next = [
        ...current,
        ...incoming.filter((f) => !known.has(`${f.name}:${f.size}`)),
      ];
      // Bring the workspace into view the first time files land.
      if (!current.length && next.length) {
        requestAnimationFrame(() =>
          sectionRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        );
      }
      return next;
    });
  }, []);

  const convert = useCallback(async () => {
    if (!selected || !files.length) return;
    setStatus("running");
    setProgress(0);
    setMessage("Préparation…");
    setError(null);
    setResults([]);

    try {
      const output = await selected.run(files, {
        options: optionValues,
        onProgress: (ratio, note) => {
          setProgress(Math.min(1, Math.max(0, ratio)));
          if (note) setMessage(note);
        },
      });
      if (!output.length) throw new Error("Aucun fichier n'a été produit.");
      setResults(dedupeNames(output));
      setStatus("done");
      setProgress(1);
      requestAnimationFrame(() =>
        resultsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        }),
      );
    } catch (caught) {
      console.error(caught);
      setStatus("error");
      setError(
        caught instanceof Error
          ? caught.message
          : "La conversion a échoué. Le fichier est peut-être corrompu.",
      );
    }
  }, [files, optionValues, selected]);

  const busy = status === "running";

  return (
    <section
      id="convertisseur"
      ref={sectionRef}
      className="mx-auto w-full max-w-5xl scroll-mt-6 px-5"
    >
      <div className="glass-strong rounded-[2rem] p-4 shadow-[0_40px_120px_-40px_rgba(88,28,235,0.55)] sm:p-7">
        {files.length === 0 ? (
          <>
            <Dropzone onFiles={addFiles} />
            <p className="mt-4 flex items-center justify-center gap-2 text-xs text-white/35">
              <ShieldCheck className="size-3.5 text-emerald-400/70" />
              Aucun octet n&apos;est transmis — pas d&apos;upload, pas de compte,
              pas de limite de taille imposée par un serveur.
            </p>
          </>
        ) : (
          <div className="space-y-6">
            <FileList
              files={files}
              disabled={busy}
              onRemove={(index) =>
                setFiles((current) => current.filter((_, i) => i !== index))
              }
              onClear={() => {
                setFiles([]);
                setResults([]);
                setStatus("idle");
                setError(null);
              }}
            />

            <Dropzone onFiles={addFiles} compact />

            <div>
              <h3 className="mb-3 text-sm font-medium text-white/70">
                Convertir en…
              </h3>
              <TargetPicker
                converters={available}
                selectedId={selectedId}
                onSelect={setSelectedId}
                disabled={busy}
              />
            </div>

            {selected?.options?.length ? (
              <OptionsPanel
                options={selected.options}
                values={optionValues}
                disabled={busy}
                onChange={(id, value) =>
                  setOptionValues((current) => ({ ...current, [id]: value }))
                }
              />
            ) : null}

            {selected && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={convert}
                  disabled={busy || !available.length}
                  className="group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-r from-brand-600 via-brand-500 to-accent-500 px-6 py-4 text-base font-semibold text-white shadow-[0_18px_50px_-18px_rgba(139,92,246,0.9)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100"
                >
                  {busy ? (
                    <>
                      <Loader2 className="size-5 animate-spin" />
                      Conversion en cours…
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-5" />
                      Convertir en {selected.to}
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>

                {busy && (
                  <div className="space-y-2">
                    <div className="h-2 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-400 to-accent-400 transition-[width] duration-200"
                        style={{ width: `${Math.round(progress * 100)}%` }}
                      />
                    </div>
                    <p className="flex items-center justify-between text-xs text-white/45">
                      <span className="truncate">{message}</span>
                      <span className="font-mono">
                        {Math.round(progress * 100)} %
                      </span>
                    </p>
                    {selected.heavy && progress < 0.15 && (
                      <p className="text-xs text-amber-300/70">
                        Le moteur WebAssembly se télécharge une seule fois par
                        session — les conversions suivantes sont immédiates.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="flex items-start gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-400" />
                <div>
                  <p className="text-sm font-medium text-rose-200">
                    Conversion impossible
                  </p>
                  <p className="mt-0.5 text-xs text-rose-200/70">{error}</p>
                </div>
              </div>
            )}

            <div ref={resultsRef}>
              {results.length > 0 && (
                <Results
                  results={results}
                  onReset={() => {
                    setFiles([]);
                    setResults([]);
                    setStatus("idle");
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
