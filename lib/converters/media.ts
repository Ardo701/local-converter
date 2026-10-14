import { LocalizedError, type Localized } from "../i18n";
import type { Converter, OutFile } from "../types";
import { runFFmpeg, toBlob } from "../ffmpeg";
import { baseOf, canvasToBlob, drawToCanvas, extOf, pad } from "../utils";
import { decodeImage } from "./images";

export const VIDEO_IN = [
  "mp4",
  "webm",
  "mkv",
  "avi",
  "mov",
  "m4v",
  "mpg",
  "mpeg",
  "wmv",
  "flv",
  "3gp",
  "ogv",
  "ts",
  "m2ts",
];

export const AUDIO_IN = [
  "mp3",
  "wav",
  "ogg",
  "oga",
  "opus",
  "flac",
  "aac",
  "m4a",
  "wma",
  "aiff",
  "aif",
  "amr",
  "weba",
];

const BITRATE_OPTION = {
  id: "bitrate",
  label: { fr: "Débit audio", en: "Audio bitrate" },
  type: "select" as const,
  default: "192",
  choices: [
    { value: "320", label: "320 kb/s — maximum" },
    { value: "256", label: "256 kb/s" },
    { value: "192", label: { fr: "192 kb/s — recommandé", en: "192 kb/s — recommended" } },
    { value: "128", label: "128 kb/s" },
    { value: "96", label: { fr: "96 kb/s — léger", en: "96 kb/s — light" } },
  ],
};

const SAMPLE_RATE_OPTION = {
  id: "rate",
  label: { fr: "Fréquence d'échantillonnage", en: "Sample rate" },
  type: "select" as const,
  default: "keep",
  choices: [
    { value: "keep", label: { fr: "Conserver l'original", en: "Keep original" } },
    { value: "48000", label: { fr: "48 000 Hz", en: "48,000 Hz" } },
    { value: "44100", label: { fr: "44 100 Hz", en: "44,100 Hz" } },
    { value: "22050", label: { fr: "22 050 Hz", en: "22,050 Hz" } },
  ],
};

const QUALITY_OPTION = {
  id: "quality",
  label: { fr: "Qualité vidéo", en: "Video quality" },
  type: "select" as const,
  default: "23",
  choices: [
    { value: "18", label: { fr: "Haute (fichier lourd)", en: "High (large file)" } },
    { value: "23", label: { fr: "Équilibrée — recommandé", en: "Balanced — recommended" } },
    { value: "28", label: { fr: "Compressée (fichier léger)", en: "Compressed (small file)" } },
  ],
};

const RESOLUTION_OPTION = {
  id: "resolution",
  label: { fr: "Résolution", en: "Resolution" },
  type: "select" as const,
  default: "keep",
  choices: [
    { value: "keep", label: { fr: "Conserver l'original", en: "Keep original" } },
    { value: "1080", label: "1080p" },
    { value: "720", label: "720p" },
    { value: "480", label: "480p" },
  ],
};

function scaleFilter(resolution: string): string[] {
  if (resolution === "keep")
    return ["-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2"];
  return ["-vf", `scale=-2:${resolution}`];
}

const AUDIO_TARGETS: Record<
  string,
  {
    label: Localized;
    mime: string;
    note: Localized;
    args: (bitrate: string) => string[];
  }
> = {
  mp3: {
    label: "MP3",
    mime: "audio/mpeg",
    note: {
      fr: "Le format universel : lu par tout, y compris le matériel ancien.",
      en: "The universal format: plays everywhere, old hardware included.",
    },
    args: (b) => ["-c:a", "libmp3lame", "-b:a", `${b}k`],
  },
  wav: {
    label: "WAV",
    mime: "audio/wav",
    note: {
      fr: "PCM non compressé. Qualité intacte, fichier volumineux.",
      en: "Uncompressed PCM. Untouched quality, large file.",
    },
    args: () => ["-c:a", "pcm_s16le"],
  },
  ogg: {
    label: "OGG (Vorbis)",
    mime: "audio/ogg",
    note: {
      fr: "Libre de brevets, plus efficace que le MP3 à débit égal.",
      en: "Patent-free, more efficient than MP3 at the same bitrate.",
    },
    args: (b) => ["-c:a", "libvorbis", "-b:a", `${b}k`],
  },
  m4a: {
    label: "AAC (.m4a)",
    mime: "audio/mp4",
    note: {
      fr: "Le format d’Apple. Tient mieux que le MP3 aux débits bas.",
      en: "Apple’s format. Holds up better than MP3 at low bitrates.",
    },
    args: (b) => ["-c:a", "aac", "-b:a", `${b}k`],
  },
  flac: {
    label: "FLAC",
    mime: "audio/flac",
    note: {
      fr: "Sans perte : l’original, pour environ la moitié du poids.",
      en: "Lossless: the original, at roughly half the size.",
    },
    args: () => ["-c:a", "flac"],
  },
};

function audioConverter(target: keyof typeof AUDIO_TARGETS): Converter {
  const spec = AUDIO_TARGETS[target];
  const lossless = target === "wav" || target === "flac";
  return {
    id: `audio→${target}`,
    to: spec.label,
    from: [...AUDIO_IN, ...VIDEO_IN],
    category: "audio",
    heavy: true,
    description: spec.note,
    options: [...(lossless ? [] : [BITRATE_OPTION]), SAMPLE_RATE_OPTION],
    async run(files, ctx) {
      const out: OutFile[] = [];
      const bitrate = String(ctx.options.bitrate ?? "192");
      const rate = String(ctx.options.rate ?? "keep");
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const share = 1 / files.length;
        const input = `input-${i}.${extOf(file.name) || "bin"}`;
        const output = `output-${i}.${target}`;
        const results = await runFFmpeg({
          inputs: [{ name: input, data: new Uint8Array(await file.arrayBuffer()) }],
          args: [
            "-i",
            input,
            "-vn",
            ...spec.args(bitrate),
            ...(rate === "keep" ? [] : ["-ar", rate]),
            output,
          ],
          output: { name: output },
          onProgress: (r, m) => ctx.onProgress(i * share + r * share, m),
          progressRange: [0.15, 1],
        });
        out.push({
          name: `${baseOf(file.name)}.${target}`,
          blob: toBlob(results[0].data, spec.mime),
        });
      }
      ctx.onProgress(1);
      return out;
    },
  };
}

const VIDEO_TARGETS: Record<
  string,
  {
    label: Localized;
    mime: string;
    note: Localized;
    args: (crf: string) => string[];
  }
> = {
  mp4: {
    label: "MP4 (H.264)",
    mime: "video/mp4",
    note: {
      fr: "H.264 dans un conteneur MP4 : ce que tout lit, partout.",
      en: "H.264 in an MP4 container: plays on anything, anywhere.",
    },
    args: (crf) => [
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      crf,
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "160k",
      "-movflags",
      "+faststart",
    ],
  },
  webm: {
    label: "WEBM (VP8)",
    mime: "video/webm",
    note: {
      fr: "VP8 dans un conteneur WebM, taillé pour la balise <video>.",
      en: "VP8 in a WebM container, made for the <video> tag.",
    },
    args: (crf) => [
      "-c:v",
      "libvpx",
      "-crf",
      crf,
      "-b:v",
      "0",
      "-deadline",
      "realtime",
      "-cpu-used",
      "5",
      "-c:a",
      "libvorbis",
    ],
  },
  mkv: {
    label: "MKV (H.264)",
    mime: "video/x-matroska",
    note: {
      fr: "Matroska : le conteneur souple, pratique pour archiver.",
      en: "Matroska: the flexible container, handy for archiving.",
    },
    args: (crf) => [
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      crf,
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "160k",
    ],
  },
  avi: {
    label: "AVI",
    mime: "video/x-msvideo",
    note: {
      fr: "Conteneur historique, pour un logiciel ou un appareil ancien.",
      en: "Legacy container, for older software or devices.",
    },
    args: () => ["-c:v", "mpeg4", "-qscale:v", "4", "-c:a", "libmp3lame"],
  },
  mov: {
    label: "MOV",
    mime: "video/quicktime",
    note: {
      fr: "QuickTime, attendu par les logiciels de montage Apple.",
      en: "QuickTime, expected by Apple’s editing software.",
    },
    args: (crf) => [
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      crf,
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
    ],
  },
};

function videoConverter(target: keyof typeof VIDEO_TARGETS): Converter {
  const spec = VIDEO_TARGETS[target];
  return {
    id: `video→${target}`,
    to: spec.label,
    from: [...VIDEO_IN, "gif"],
    category: "video",
    heavy: true,
    description: spec.note,
    options: [QUALITY_OPTION, RESOLUTION_OPTION],
    async run(files, ctx) {
      const out: OutFile[] = [];
      const crf = String(ctx.options.quality ?? "23");
      const resolution = String(ctx.options.resolution ?? "keep");
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const share = 1 / files.length;
        const input = `input-${i}.${extOf(file.name) || "bin"}`;
        const output = `output-${i}.${target}`;
        const results = await runFFmpeg({
          inputs: [{ name: input, data: new Uint8Array(await file.arrayBuffer()) }],
          args: [
            "-i",
            input,
            ...scaleFilter(resolution),
            ...spec.args(crf),
            output,
          ],
          output: { name: output },
          onProgress: (r, m) => ctx.onProgress(i * share + r * share, m),
          progressRange: [0.15, 1],
        });
        out.push({
          name: `${baseOf(file.name)}.${target}`,
          blob: toBlob(results[0].data, spec.mime),
        });
      }
      ctx.onProgress(1);
      return out;
    },
  };
}

const videoToGif: Converter = {
  id: "video→gif",
  to: { fr: "GIF animé", en: "Animated GIF" },
  from: VIDEO_IN,
  category: "video",
  heavy: true,
  description: {
    fr: "Génère une palette optimisée puis encode un GIF animé.",
    en: "Builds an optimized palette, then encodes an animated GIF.",
  },
  options: [
    {
      id: "fps",
      label: { fr: "Images par seconde", en: "Frames per second" },
      type: "select",
      default: "12",
      choices: [
        { value: "24", label: { fr: "24 fps — fluide", en: "24 fps — smooth" } },
        { value: "15", label: "15 fps" },
        { value: "12", label: { fr: "12 fps — recommandé", en: "12 fps — recommended" } },
        { value: "8", label: { fr: "8 fps — léger", en: "8 fps — light" } },
      ],
    },
    {
      id: "width",
      label: { fr: "Largeur", en: "Width" },
      type: "select",
      default: "640",
      choices: [
        { value: "960", label: "960 px" },
        { value: "640", label: "640 px" },
        { value: "480", label: "480 px" },
        { value: "320", label: "320 px" },
      ],
    },
    {
      id: "duration",
      label: { fr: "Durée maximale", en: "Maximum duration" },
      type: "number",
      default: 15,
      min: 1,
      max: 120,
      step: 1,
      suffix: "s",
    },
  ],
  async run(files, ctx) {
    const fps = String(ctx.options.fps ?? "12");
    const width = String(ctx.options.width ?? "640");
    const duration = String(ctx.options.duration ?? 15);
    const out: OutFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const share = 1 / files.length;
      const input = `input-${i}.${extOf(file.name) || "bin"}`;
      const output = `output-${i}.gif`;
      const results = await runFFmpeg({
        inputs: [{ name: input, data: new Uint8Array(await file.arrayBuffer()) }],
        args: [
          "-t",
          duration,
          "-i",
          input,
          "-filter_complex",
          `fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3`,
          "-loop",
          "0",
          output,
        ],
        output: { name: output },
        onProgress: (r, m) => ctx.onProgress(i * share + r * share, m),
        progressRange: [0.15, 1],
      });
      out.push({
        name: `${baseOf(file.name)}.gif`,
        blob: toBlob(results[0].data, "image/gif"),
      });
    }
    ctx.onProgress(1);
    return out;
  },
};

/**
 * Runs a frame-extraction pass. Clips shorter than the requested interval
 * produce nothing, so fall back to grabbing the very first frame.
 */
async function extractFrames(opts: {
  input: string;
  data: Uint8Array;
  filters: string[];
  pattern: string;
  extension: string;
  prefix: string;
  onProgress: (ratio: number, message?: Localized) => void;
}) {
  const base = {
    inputs: [{ name: opts.input, data: opts.data }],
    output: { prefix: opts.prefix, extension: opts.extension },
    onProgress: opts.onProgress,
    progressRange: [0.15, 1] as [number, number],
  };
  try {
    return await runFFmpeg({
      ...base,
      args: [
        "-i",
        opts.input,
        "-vf",
        opts.filters.join(","),
        "-vsync",
        "0",
        opts.pattern,
      ],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!/aucun|aucune image|Output file is empty/i.test(message)) throw error;
    const scaleOnly = opts.filters.filter((f) => !f.startsWith("fps="));
    return await runFFmpeg({
      ...base,
      args: [
        "-i",
        opts.input,
        ...(scaleOnly.length ? ["-vf", scaleOnly.join(",")] : []),
        "-frames:v",
        "1",
        opts.pattern,
      ],
    });
  }
}

const videoToFrames: Converter = {
  id: "video→frames",
  to: { fr: "Séquence d'images", en: "Image sequence" },
  from: VIDEO_IN,
  category: "video",
  heavy: true,
  multiOutput: true,
  description: {
    fr: "Extrait une image toutes les X secondes.",
    en: "Extracts one frame every X seconds.",
  },
  options: [
    {
      id: "interval",
      label: { fr: "Une image toutes les", en: "One frame every" },
      type: "number",
      default: 1,
      min: 0.1,
      max: 60,
      step: 0.1,
      suffix: "s",
    },
    {
      id: "format",
      label: "Format",
      type: "select",
      default: "jpg",
      choices: [
        { value: "jpg", label: "JPG" },
        { value: "png", label: "PNG" },
      ],
    },
    {
      id: "width",
      label: { fr: "Largeur (0 = originale)", en: "Width (0 = original)" },
      type: "number",
      default: 0,
      min: 0,
      max: 3840,
      step: 10,
      suffix: "px",
    },
  ],
  async run(files, ctx) {
    const interval = Number(ctx.options.interval ?? 1);
    const format = String(ctx.options.format ?? "jpg");
    const width = Number(ctx.options.width ?? 0);
    const out: OutFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const share = 1 / files.length;
      const input = `input-${i}.${extOf(file.name) || "bin"}`;
      const filters = [`fps=1/${interval}`];
      if (width > 0) filters.push(`scale=${width}:-2`);
      const results = await extractFrames({
        input,
        data: new Uint8Array(await file.arrayBuffer()),
        filters,
        pattern: `frame-%04d.${format}`,
        prefix: "frame-",
        extension: `.${format}`,
        onProgress: (r, m) => ctx.onProgress(i * share + r * share, m),
      });
      results.forEach((r, index) => {
        out.push({
          name: `${baseOf(file.name)}-${pad(index + 1, 4)}.${format}`,
          blob: toBlob(r.data, format === "png" ? "image/png" : "image/jpeg"),
        });
      });
    }
    ctx.onProgress(1);
    return out;
  },
};

const videoToSheet: Converter = {
  id: "video→sheet",
  to: { fr: "Mosaïque de vignettes", en: "Contact sheet" },
  from: VIDEO_IN,
  category: "video",
  heavy: true,
  description: {
    fr: "Assemble des captures régulières en une planche contact.",
    en: "Lays out regular captures on a single contact sheet.",
  },
  options: [
    {
      id: "interval",
      label: { fr: "Une vignette toutes les", en: "One thumbnail every" },
      type: "number",
      default: 5,
      min: 0.5,
      max: 120,
      step: 0.5,
      suffix: "s",
    },
    {
      id: "columns",
      label: { fr: "Colonnes", en: "Columns" },
      type: "number",
      default: 4,
      min: 1,
      max: 12,
      step: 1,
    },
    {
      id: "thumbWidth",
      label: { fr: "Largeur d'une vignette", en: "Thumbnail width" },
      type: "number",
      default: 320,
      min: 80,
      max: 640,
      step: 10,
      suffix: "px",
    },
  ],
  async run(files, ctx) {
    const interval = Number(ctx.options.interval ?? 5);
    const requestedColumns = Number(ctx.options.columns ?? 4);
    const thumbWidth = Number(ctx.options.thumbWidth ?? 320);
    const gap = 4;
    const out: OutFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const share = 1 / files.length;
      const input = `input-${i}.${extOf(file.name) || "bin"}`;
      // Extract the thumbnails first, then compose them on a canvas — far more
      // predictable than ffmpeg's tile filter on clips of unknown length.
      const results = await extractFrames({
        input,
        data: new Uint8Array(await file.arrayBuffer()),
        filters: [`fps=1/${interval}`, `scale=${thumbWidth}:-2`],
        pattern: "thumb-%04d.png",
        prefix: "thumb-",
        extension: ".png",
        onProgress: (r, m) => ctx.onProgress(i * share + r * share * 0.8, m),
      });

      const bitmaps = await Promise.all(
        results.map((r) => createImageBitmap(toBlob(r.data, "image/png"))),
      );
      const columns = Math.max(1, Math.min(requestedColumns, bitmaps.length));
      const rows = Math.ceil(bitmaps.length / columns);
      const cellWidth = bitmaps[0].width;
      const cellHeight = bitmaps[0].height;

      const sheet = document.createElement("canvas");
      sheet.width = columns * cellWidth + gap * (columns + 1);
      sheet.height = rows * cellHeight + gap * (rows + 1);
      const sheetCtx = sheet.getContext("2d")!;
      sheetCtx.fillStyle = "#000000";
      sheetCtx.fillRect(0, 0, sheet.width, sheet.height);
      bitmaps.forEach((bitmap, index) => {
        sheetCtx.drawImage(
          bitmap,
          gap + (index % columns) * (cellWidth + gap),
          gap + Math.floor(index / columns) * (cellHeight + gap),
        );
        bitmap.close();
      });

      out.push({
        name: `${baseOf(file.name)}-mosaique.png`,
        blob: await canvasToBlob(sheet, "image/png"),
      });
      ctx.onProgress((i + 1) * share);
    }
    ctx.onProgress(1);
    return out;
  },
};

/** Normalises every dropped image to PNG so ffmpeg gets a clean sequence. */
async function imagesToPngSequence(
  files: File[],
  onProgress: (ratio: number, message?: Localized) => void,
) {
  const sorted = [...files].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true }),
  );
  const inputs: { name: string; data: Uint8Array }[] = [];
  for (let i = 0; i < sorted.length; i++) {
    onProgress((i / sorted.length) * 0.3, {
      fr: `Préparation ${i + 1}/${sorted.length}`,
      en: `Preparing ${i + 1}/${sorted.length}`,
    });
    const decoded = await decodeImage(sorted[i]);
    const canvas = drawToCanvas(
      decoded.source,
      decoded.width,
      decoded.height,
      "#000000",
    );
    const blob = await canvasToBlob(canvas, "image/png");
    inputs.push({
      name: `seq-${pad(i + 1, 5)}.png`,
      data: new Uint8Array(await blob.arrayBuffer()),
    });
  }
  return inputs;
}

// A GIF is already an animation — `video→…` handles it, not the sequence path.
const IMAGE_SEQ_IN = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "bmp",
  "tif",
  "tiff",
  "heic",
  "heif",
  "svg",
  "avif",
];

function sequenceConverter(target: "mp4" | "webm" | "gif"): Converter {
  const labels = {
    mp4: { fr: "Vidéo MP4", en: "MP4 video" },
    webm: { fr: "Vidéo WEBM", en: "WEBM video" },
    gif: { fr: "GIF animé", en: "Animated GIF" },
  };
  const mimes = { mp4: "video/mp4", webm: "video/webm", gif: "image/gif" };
  return {
    id: `sequence→${target}`,
    to: labels[target],
    from: IMAGE_SEQ_IN,
    category: "video",
    heavy: true,
    batch: true,
    minFiles: 2,
    description:
      target === "gif"
        ? {
            fr: "Assemble les images (triées par nom) en un GIF qui boucle.",
            en: "Joins the images (sorted by name) into a looping GIF.",
          }
        : {
            fr: `Assemble les images (triées par nom) en une vidéo ${target === "mp4" ? "MP4" : "WebM"}.`,
            en: `Joins the images (sorted by name) into ${target === "mp4" ? "an MP4" : "a WebM"} video.`,
          },
    options: [
      {
        id: "fps",
        label: { fr: "Images par seconde", en: "Frames per second" },
        type: "number",
        default: 12,
        min: 1,
        max: 60,
        step: 1,
        suffix: "fps",
      },
    ],
    async run(files, ctx) {
      if (files.length < 2) {
        throw new LocalizedError({
          fr: "Sélectionnez au moins deux images pour construire une animation.",
          en: "Select at least two images to build an animation.",
        });
      }
      const fps = String(ctx.options.fps ?? 12);
      const inputs = await imagesToPngSequence(files, ctx.onProgress);
      const output = `sequence.${target}`;
      const args =
        target === "gif"
          ? [
              "-framerate",
              fps,
              "-i",
              "seq-%05d.png",
              "-filter_complex",
              "scale=trunc(iw/2)*2:trunc(ih/2)*2,split[a][b];[a]palettegen[p];[b][p]paletteuse",
              "-loop",
              "0",
              output,
            ]
          : target === "mp4"
            ? [
                "-framerate",
                fps,
                "-i",
                "seq-%05d.png",
                "-vf",
                "scale=trunc(iw/2)*2:trunc(ih/2)*2",
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-crf",
                "20",
                "-pix_fmt",
                "yuv420p",
                output,
              ]
            : [
                "-framerate",
                fps,
                "-i",
                "seq-%05d.png",
                "-vf",
                "scale=trunc(iw/2)*2:trunc(ih/2)*2",
                "-c:v",
                "libvpx",
                "-crf",
                "20",
                "-b:v",
                "1M",
                "-deadline",
                "realtime",
                "-cpu-used",
                "5",
                output,
              ];
      const results = await runFFmpeg({
        inputs,
        args,
        output: { name: output },
        onProgress: ctx.onProgress,
        progressRange: [0.35, 1],
      });
      ctx.onProgress(1);
      return [
        {
          name: `animation.${target}`,
          blob: toBlob(results[0].data, mimes[target]),
        },
      ];
    },
  };
}

export const audioConverters: Converter[] = (
  Object.keys(AUDIO_TARGETS) as (keyof typeof AUDIO_TARGETS)[]
).map(audioConverter);

export const videoConverters: Converter[] = [
  ...(Object.keys(VIDEO_TARGETS) as (keyof typeof VIDEO_TARGETS)[]).map(
    videoConverter,
  ),
  videoToGif,
  videoToFrames,
  videoToSheet,
  sequenceConverter("mp4"),
  sequenceConverter("webm"),
  sequenceConverter("gif"),
];
