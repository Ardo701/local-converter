"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Dropzone from "./Dropzone";
import FileList from "./FileList";
import OptionsPanel from "./OptionsPanel";
import Results from "./Results";
import TargetPicker from "./TargetPicker";
import { converterById, matchingConverters } from "@/lib/registry";
import type { OutFile } from "@/lib/types";
import { dedupeNames, humanSize } from "@/lib/utils";

type Status = "idle" | "running" | "done" | "error";

function Step({
  number,
  title,
  meta,
  action,
}: {
  number: string;
  title: string;
  meta?: string;
  action?: { label: string; onClick: () => void; disabled?: boolean };
}) {
  return (
    <div className="flex items-baseline gap-3 border-b border-rule px-5 py-2.5">
      <span className="nums font-mono text-[11px] text-accent">{number}</span>
      <h2 className="label">{title}</h2>
      {meta && (
        <span className="nums truncate font-mono text-[11px] text-faint">
          {meta}
        </span>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          className="ml-auto shrink-0 text-[12px] text-muted underline underline-offset-[3px] hover:text-accent disabled:opacity-40"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

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
  const sectionRef = useRef<HTMLElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const available = useMemo(() => matchingConverters(files), [files]);
  const selected = selectedId ? (converterById.get(selectedId) ?? null) : null;
  const busy = status === "running";
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  useEffect(() => {
    if (!available.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) =>
      current && available.some((c) => c.id === current)
        ? current
        : available[0].id,
    );
  }, [available]);

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
    setMessage("Préparation");
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
      if (!output.length) throw new Error("Aucun fichier n’a été produit.");
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

  const stepNumbers = {
    files: "01",
    format: "02",
    settings: "03",
  };

  return (
    <section
      id="convertisseur"
      ref={sectionRef}
      className="mx-auto w-full max-w-5xl scroll-mt-4 px-6 pb-20"
    >
      <div className="border border-edge bg-surface">
        <Step
          number={stepNumbers.files}
          title="Fichiers"
          meta={
            files.length
              ? `${files.length} · ${humanSize(totalSize)}`
              : undefined
          }
          action={
            files.length
              ? {
                  label: "Tout retirer",
                  disabled: busy,
                  onClick: () => {
                    setFiles([]);
                    setResults([]);
                    setStatus("idle");
                    setError(null);
                  },
                }
              : undefined
          }
        />

        {files.length === 0 ? (
          <Dropzone onFiles={addFiles} />
        ) : (
          <>
            <FileList
              files={files}
              disabled={busy}
              onRemove={(index) =>
                setFiles((current) => current.filter((_, i) => i !== index))
              }
            />
            <div className="border-t border-rule">
              <Dropzone onFiles={addFiles} compact />
            </div>

            <div className="border-t border-edge">
              <Step
                number={stepNumbers.format}
                title="Format de sortie"
                meta={`${available.length} possible${available.length > 1 ? "s" : ""}`}
              />
              <TargetPicker
                converters={available}
                selectedId={selectedId}
                onSelect={setSelectedId}
                disabled={busy}
              />
            </div>

            {selected?.options?.length ? (
              <div className="border-t border-edge">
                <Step number={stepNumbers.settings} title="Réglages" />
                <OptionsPanel
                  options={selected.options}
                  values={optionValues}
                  disabled={busy}
                  onChange={(id, value) =>
                    setOptionValues((current) => ({ ...current, [id]: value }))
                  }
                />
              </div>
            ) : null}

            {selected && (
              <div className="border-t border-edge">
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4">
                  <p className="min-w-0 flex-1 font-mono text-[11.5px] text-faint">
                    {busy ? (
                      <>
                        <span className="nums text-accent">
                          {String(Math.round(progress * 100)).padStart(3, " ")}%
                        </span>
                        <span className="ml-3 text-muted">{message}</span>
                      </>
                    ) : status === "done" ? (
                      <span className="text-muted">Terminé.</span>
                    ) : (
                      <span>
                        {files.length} fichier{files.length > 1 ? "s" : ""} →{" "}
                        {selected.to}
                        {selected.heavy && " · moteur WebAssembly au 1er usage"}
                      </span>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={convert}
                    disabled={busy || !available.length}
                    className="shrink-0 rounded-[3px] bg-ink px-6 py-2 text-[13.5px] font-medium text-paper transition-colors duration-100 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-ink"
                  >
                    {busy ? "Conversion…" : "Convertir"}
                  </button>
                </div>
                <div className="h-px w-full bg-rule">
                  <div
                    className="h-px bg-accent transition-[width] duration-150"
                    style={{ width: `${busy || status === "done" ? progress * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="border-t border-edge bg-accent-soft px-5 py-3.5">
                <p className="label text-accent">Échec</p>
                <p className="mt-1 text-[13.5px] text-ink">{error}</p>
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
          </>
        )}
      </div>
    </section>
  );
}
