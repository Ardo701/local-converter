import type { Converter, OutFile } from "../types";
import { baseOf, extOf, textBlob } from "../utils";
import { runFFmpeg } from "../ffmpeg";
import { AUDIO_IN, VIDEO_IN } from "./media";

type Chunk = { text: string; timestamp: [number, number | null] };

let transcriberCache: { key: string; instance: unknown } | null = null;

async function getTranscriber(
  model: string,
  onProgress: (ratio: number, message?: string) => void,
) {
  if (transcriberCache?.key === model) return transcriberCache.instance as never;
  const { pipeline, env } = await import("@huggingface/transformers");
  env.allowLocalModels = false;

  const supportsWebGpu =
    typeof navigator !== "undefined" && "gpu" in navigator;

  const build = async (device: "webgpu" | "wasm") =>
    await pipeline("automatic-speech-recognition", model, {
      device,
      dtype: device === "webgpu" ? "fp32" : "q8",
      progress_callback: (info: { status?: string; progress?: number }) => {
        if (info.status === "progress" && typeof info.progress === "number") {
          onProgress(
            0.05 + (info.progress / 100) * 0.35,
            "Téléchargement du modèle de transcription…",
          );
        }
      },
    });

  let instance;
  try {
    instance = await build(supportsWebGpu ? "webgpu" : "wasm");
  } catch {
    instance = await build("wasm");
  }
  transcriberCache = { key: model, instance };
  return instance as never;
}

/** Decodes any media file into the 16 kHz mono Float32 signal Whisper expects. */
async function toMonoPcm(
  file: File,
  onProgress: (ratio: number, message?: string) => void,
): Promise<Float32Array> {
  let buffer = await file.arrayBuffer();
  const ext = extOf(file.name);

  const AudioContextCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;

  const decode = async (data: ArrayBuffer) => {
    const audioContext = new AudioContextCtor({ sampleRate: 16000 });
    try {
      const decoded = await audioContext.decodeAudioData(data);
      if (decoded.numberOfChannels === 1) return decoded.getChannelData(0);
      const left = decoded.getChannelData(0);
      const right = decoded.getChannelData(1);
      const mono = new Float32Array(left.length);
      for (let i = 0; i < left.length; i++) mono[i] = (left[i] + right[i]) / 2;
      return mono;
    } finally {
      await audioContext.close();
    }
  };

  if (!VIDEO_IN.includes(ext)) {
    try {
      return await decode(buffer.slice(0));
    } catch {
      /* fall back to ffmpeg below */
    }
  }

  onProgress(0.42, "Extraction de la piste audio…");
  const input = `speech-input.${ext || "bin"}`;
  const results = await runFFmpeg({
    inputs: [{ name: input, data: new Uint8Array(buffer) }],
    args: ["-i", input, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", "speech.wav"],
    output: { name: "speech.wav" },
    onProgress: (r, m) => onProgress(0.42 + r * 0.08, m),
    progressRange: [0.2, 1],
  });
  buffer = results[0].data.slice().buffer as ArrayBuffer;
  return decode(buffer);
}

function formatTimestamp(seconds: number, separator: string): string {
  const clamped = Math.max(0, seconds);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const secs = Math.floor(clamped % 60);
  const millis = Math.round((clamped - Math.floor(clamped)) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(
    secs,
  ).padStart(2, "0")}${separator}${String(millis).padStart(3, "0")}`;
}

function toSrt(chunks: Chunk[]): string {
  return chunks
    .map((chunk, i) => {
      const start = chunk.timestamp[0] ?? 0;
      const end = chunk.timestamp[1] ?? start + 2;
      return `${i + 1}\n${formatTimestamp(start, ",")} --> ${formatTimestamp(
        end,
        ",",
      )}\n${chunk.text.trim()}\n`;
    })
    .join("\n");
}

function toVtt(chunks: Chunk[]): string {
  const body = chunks
    .map((chunk) => {
      const start = chunk.timestamp[0] ?? 0;
      const end = chunk.timestamp[1] ?? start + 2;
      return `${formatTimestamp(start, ".")} --> ${formatTimestamp(
        end,
        ".",
      )}\n${chunk.text.trim()}\n`;
    })
    .join("\n");
  return `WEBVTT\n\n${body}`;
}

const MODEL_OPTION = {
  id: "model",
  label: "Modèle Whisper",
  type: "select" as const,
  default: "onnx-community/whisper-base",
  choices: [
    { value: "onnx-community/whisper-tiny", label: "Tiny — rapide (~50 Mo)" },
    {
      value: "onnx-community/whisper-base",
      label: "Base — équilibré (~80 Mo)",
    },
    { value: "onnx-community/whisper-small", label: "Small — précis (~250 Mo)" },
  ],
};

const LANGUAGE_OPTION = {
  id: "language",
  label: "Langue parlée",
  type: "select" as const,
  default: "french",
  choices: [
    { value: "french", label: "Français" },
    { value: "english", label: "Anglais" },
    { value: "spanish", label: "Espagnol" },
    { value: "german", label: "Allemand" },
    { value: "italian", label: "Italien" },
    { value: "portuguese", label: "Portugais" },
    { value: "dutch", label: "Néerlandais" },
    { value: "auto", label: "Détection automatique" },
  ],
};

function transcriptionConverter(format: "txt" | "srt" | "vtt"): Converter {
  const labels = {
    txt: "Texte (.txt)",
    srt: "Sous-titres (.srt)",
    vtt: "Sous-titres (.vtt)",
  };
  return {
    id: `speech→${format}`,
    to: labels[format],
    from: [...AUDIO_IN, ...VIDEO_IN],
    category: "audio",
    heavy: true,
    description:
      "Transcription vocale par Whisper, exécutée entièrement dans le navigateur (WebGPU si disponible).",
    options: [MODEL_OPTION, LANGUAGE_OPTION],
    async run(files, ctx) {
      const model = String(ctx.options.model ?? "onnx-community/whisper-base");
      const language = String(ctx.options.language ?? "french");
      const out: OutFile[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const share = 1 / files.length;
        const report = (r: number, m?: string) =>
          ctx.onProgress(i * share + r * share, m);

        const transcriber = await getTranscriber(model, report);
        const audio = await toMonoPcm(file, report);
        report(0.55, "Transcription en cours…");

        const result = (await (
          transcriber as (
            input: Float32Array,
            options: Record<string, unknown>,
          ) => Promise<{ text: string; chunks?: Chunk[] }>
        )(audio, {
          chunk_length_s: 30,
          stride_length_s: 5,
          return_timestamps: format !== "txt",
          ...(language === "auto" ? {} : { language, task: "transcribe" }),
        })) as { text: string; chunks?: Chunk[] };

        const chunks = result.chunks ?? [];
        const content =
          format === "txt"
            ? result.text.trim()
            : format === "srt"
              ? toSrt(chunks)
              : toVtt(chunks);

        if (!content.trim()) throw new Error("Aucune parole détectée.");
        out.push({
          name: `${baseOf(file.name)}.${format}`,
          blob: textBlob(
            content,
            format === "txt" ? "text/plain" : `text/${format}`,
          ),
        });
      }
      ctx.onProgress(1);
      return out;
    },
  };
}

export const transcriptionConverters: Converter[] = [
  transcriptionConverter("txt"),
  transcriptionConverter("srt"),
  transcriptionConverter("vtt"),
];
