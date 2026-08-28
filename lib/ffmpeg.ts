import type { FFmpeg } from "@ffmpeg/ffmpeg";

/** Served from our own origin — copied into public/ffmpeg at build time. */
const CORE_BASE = "/ffmpeg";

let instance: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;

export type FFmpegLoadProgress = (ratio: number, message: string) => void;

/**
 * Loads the single-threaded ffmpeg-core (~32 Mo) once per tab. Everything is
 * fetched into a blob URL so the worker stays same-origin.
 */
export async function getFFmpeg(onProgress?: FFmpegLoadProgress): Promise<FFmpeg> {
  if (instance) return instance;
  if (!loading) {
    loading = (async () => {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { toBlobURL } = await import("@ffmpeg/util");
      const ffmpeg = new FFmpeg();
      onProgress?.(0.02, "Chargement du moteur FFmpeg (~32 Mo, une seule fois)…");
      const coreURL = await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript");
      onProgress?.(0.25, "Chargement du moteur FFmpeg…");
      const wasmURL = await toBlobURL(
        `${CORE_BASE}/ffmpeg-core.wasm`,
        "application/wasm",
      );
      onProgress?.(0.9, "Initialisation de FFmpeg…");
      await ffmpeg.load({ coreURL, wasmURL });
      onProgress?.(1, "FFmpeg prêt");
      instance = ffmpeg;
      return ffmpeg;
    })().catch((error) => {
      loading = null;
      throw error;
    });
  }
  return loading;
}

export function isFFmpegReady() {
  return instance !== null;
}

export type FFmpegRunOptions = {
  /** files written to the virtual filesystem before running */
  inputs: { name: string; data: Uint8Array }[];
  args: string[];
  /** exact output names, or a prefix match for numbered sequences */
  output: { name: string } | { prefix: string; extension: string };
  onProgress?: (ratio: number, message?: string) => void;
  /** used to translate ffmpeg's progress into an overall ratio */
  progressRange?: [number, number];
};

export type FFmpegOutput = { name: string; data: Uint8Array };

/** Writes inputs, runs one ffmpeg command, and collects the produced files. */
export async function runFFmpeg(opts: FFmpegRunOptions): Promise<FFmpegOutput[]> {
  const [from, to] = opts.progressRange ?? [0, 1];
  const ffmpeg = await getFFmpeg((ratio, message) =>
    opts.onProgress?.(from * ratio, message),
  );

  const handler = ({ progress }: { progress: number }) => {
    const clamped = Math.min(1, Math.max(0, progress));
    opts.onProgress?.(from + (to - from) * clamped, "Encodage…");
  };
  ffmpeg.on("progress", handler);

  // Keep the tail of the log so a failure can be explained in plain French.
  const log: string[] = [];
  const logHandler = ({ message }: { message: string }) => {
    log.push(message);
    if (log.length > 60) log.shift();
  };
  ffmpeg.on("log", logHandler);

  const written: string[] = [];
  try {
    for (const input of opts.inputs) {
      // The worker transfers (and detaches) the buffer, so hand it a copy —
      // callers may need to reuse their data for a retry.
      await ffmpeg.writeFile(input.name, input.data.slice());
      written.push(input.name);
    }
    const code = await ffmpeg.exec(opts.args);
    if (code !== 0) throw new Error(explainFailure(log));

    const results: FFmpegOutput[] = [];
    if ("name" in opts.output) {
      const data = (await ffmpeg.readFile(opts.output.name)) as Uint8Array;
      results.push({ name: opts.output.name, data });
      written.push(opts.output.name);
    } else {
      const { prefix, extension } = opts.output;
      const entries = await ffmpeg.listDir("/");
      const produced = entries
        .filter(
          (e) =>
            !e.isDir &&
            e.name.startsWith(prefix) &&
            e.name.endsWith(extension),
        )
        .map((e) => e.name)
        .sort();
      if (!produced.length) throw new Error("FFmpeg n'a produit aucun fichier.");
      for (const name of produced) {
        results.push({ name, data: (await ffmpeg.readFile(name)) as Uint8Array });
        written.push(name);
      }
    }
    return results;
  } finally {
    ffmpeg.off("progress", handler);
    ffmpeg.off("log", logHandler);
    for (const name of written) {
      try {
        await ffmpeg.deleteFile(name);
      } catch {
        /* already gone */
      }
    }
  }
}

/** Turns the ffmpeg log tail into an actionable message. */
function explainFailure(log: string[]): string {
  const text = log.join("\n");
  if (/does not contain any stream/i.test(text)) {
    return "Ce fichier ne contient pas la piste demandée — une vidéo sans son, par exemple.";
  }
  if (/Invalid data found when processing input|moov atom not found/i.test(text)) {
    return "Le fichier semble corrompu ou tronqué : FFmpeg ne parvient pas à le lire.";
  }
  if (/Decoder \(codec .*\) not found|Unknown encoder/i.test(text)) {
    return "Ce codec n'est pas inclus dans la version WebAssembly de FFmpeg.";
  }
  if (/Output file is empty|No such file or directory/i.test(text)) {
    return "FFmpeg n'a produit aucune image : le média est peut-être trop court pour ces réglages.";
  }
  const lastError = [...log].reverse().find((line) => /error|invalid|failed/i.test(line));
  return lastError
    ? `FFmpeg a échoué : ${lastError.trim()}`
    : "FFmpeg n'a pas pu traiter ce fichier (codec ou conteneur non supporté).";
}

export { bytesBlob as toBlob } from "./utils";
