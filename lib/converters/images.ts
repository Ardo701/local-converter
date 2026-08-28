import type { Converter, OutFile } from "../types";
import {
  baseOf,
  canvasToBlob,
  drawToCanvas,
  extOf,
  loadBitmap,
  pad,
  toImageData,
} from "../utils";

const RASTER_IN = ["jpg", "jpeg", "png", "webp", "bmp", "gif", "avif", "ico"];

const QUALITY_OPTION = {
  id: "quality",
  label: "Qualité",
  type: "range" as const,
  default: 92,
  min: 40,
  max: 100,
  step: 1,
  suffix: "%",
};

const BACKGROUND_OPTION = {
  id: "background",
  label: "Fond (zones transparentes)",
  type: "select" as const,
  default: "#ffffff",
  choices: [
    { value: "#ffffff", label: "Blanc" },
    { value: "#000000", label: "Noir" },
    { value: "#18181b", label: "Gris sombre" },
  ],
};

const SCALE_OPTION = {
  id: "scale",
  label: "Échelle",
  type: "select" as const,
  default: "1",
  choices: [
    { value: "0.5", label: "0,5× (réduction)" },
    { value: "1", label: "1× (taille d'origine)" },
    { value: "2", label: "2× (haute définition)" },
    { value: "3", label: "3×" },
    { value: "4", label: "4×" },
  ],
};

type Decoded = {
  source: CanvasImageSource;
  width: number;
  height: number;
};

async function decodeSvg(file: File, scale: number): Promise<Decoded> {
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const svg = doc.documentElement;
  let width = parseFloat(svg.getAttribute("width") || "");
  let height = parseFloat(svg.getAttribute("height") || "");
  const viewBox = (svg.getAttribute("viewBox") || "")
    .split(/[\s,]+/)
    .map(Number);
  if ((!width || !height) && viewBox.length === 4) {
    width = viewBox[2];
    height = viewBox[3];
  }
  if (!width || !height) {
    width = 1024;
    height = 1024;
  }
  const url = URL.createObjectURL(
    new Blob([text], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("SVG illisible"));
      el.src = url;
    });
    return {
      source: img,
      width: width * scale,
      height: height * scale,
    };
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

async function decodeTiff(file: File): Promise<Decoded> {
  const UTIF = await import("utif");
  const buffer = await file.arrayBuffer();
  const ifds = UTIF.decode(buffer);
  if (!ifds.length) throw new Error("TIFF vide");
  UTIF.decodeImage(buffer, ifds[0]);
  const rgba = UTIF.toRGBA8(ifds[0]);
  const width = ifds[0].width;
  const height = ifds[0].height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(toImageData(rgba, width, height), 0, 0);
  return { source: canvas, width, height };
}

async function decodeHeic(file: File): Promise<Decoded> {
  const heic2any = (await import("heic2any")).default;
  const converted = (await heic2any({
    blob: file,
    toType: "image/png",
  })) as Blob | Blob[];
  const blob = Array.isArray(converted) ? converted[0] : converted;
  const bitmap = await loadBitmap(blob);
  return {
    source: bitmap,
    width: bitmap.width as number,
    height: bitmap.height as number,
  };
}

/** Decodes any supported still image into something drawable on a canvas. */
export async function decodeImage(file: File, scale = 1): Promise<Decoded> {
  const ext = extOf(file.name);
  if (ext === "svg" || file.type === "image/svg+xml")
    return decodeSvg(file, scale);
  if (ext === "tif" || ext === "tiff") {
    const d = await decodeTiff(file);
    return { ...d, width: d.width * scale, height: d.height * scale };
  }
  if (ext === "heic" || ext === "heif") {
    const d = await decodeHeic(file);
    return { ...d, width: d.width * scale, height: d.height * scale };
  }
  const bitmap = await loadBitmap(file);
  return {
    source: bitmap,
    width: (bitmap.width as number) * scale,
    height: (bitmap.height as number) * scale,
  };
}

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

function rasterConverter(
  from: string[],
  target: "png" | "jpg" | "webp",
  description: string,
  opts: { scale?: boolean } = {},
): Converter {
  const options = [
    ...(opts.scale ? [SCALE_OPTION] : []),
    ...(target === "png" ? [] : [QUALITY_OPTION]),
    ...(target === "jpg" ? [BACKGROUND_OPTION] : []),
  ];
  return {
    id: `${from[0]}→${target}`,
    to: target.toUpperCase(),
    from,
    category: "images",
    description,
    options,
    async run(files, ctx) {
      const out: OutFile[] = [];
      const scale = opts.scale ? Number(ctx.options.scale ?? 1) : 1;
      const quality = Number(ctx.options.quality ?? 92) / 100;
      const background =
        target === "jpg" ? String(ctx.options.background ?? "#ffffff") : undefined;
      for (let i = 0; i < files.length; i++) {
        ctx.onProgress(i / files.length, files[i].name);
        const decoded = await decodeImage(files[i], scale);
        const canvas = drawToCanvas(
          decoded.source,
          decoded.width,
          decoded.height,
          background,
        );
        const blob = await canvasToBlob(
          canvas,
          MIME[target],
          target === "png" ? undefined : quality,
        );
        out.push({ name: `${baseOf(files[i].name)}.${target}`, blob });
      }
      ctx.onProgress(1);
      return out;
    },
  };
}

async function gifFrames(file: File) {
  const { parseGIF, decompressFrames } = await import("gifuct-js");
  const gif = parseGIF(await file.arrayBuffer());
  const frames = decompressFrames(gif, true);
  if (!frames.length) throw new Error("Aucune image dans ce GIF");
  const width = gif.lsd.width;
  const height = gif.lsd.height;

  // GIF frames are patches applied on a persistent canvas — replay them.
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const patch = document.createElement("canvas");
  const patchCtx = patch.getContext("2d")!;

  const rendered: HTMLCanvasElement[] = [];
  for (const frame of frames) {
    if (frame.disposalType === 2) {
      ctx.clearRect(
        frame.dims.left,
        frame.dims.top,
        frame.dims.width,
        frame.dims.height,
      );
    }
    patch.width = frame.dims.width;
    patch.height = frame.dims.height;
    patchCtx.putImageData(
      toImageData(frame.patch, frame.dims.width, frame.dims.height),
      0,
      0,
    );
    ctx.drawImage(patch, frame.dims.left, frame.dims.top);
    const snapshot = document.createElement("canvas");
    snapshot.width = width;
    snapshot.height = height;
    snapshot.getContext("2d")!.drawImage(canvas, 0, 0);
    rendered.push(snapshot);
  }
  return { frames: rendered, width, height };
}

const gifToFrames: Converter = {
  id: "gif→frames",
  to: "Séquence d'images",
  from: ["gif"],
  category: "images",
  description: "Décompose un GIF animé en une image par frame.",
  multiOutput: true,
  options: [
    {
      id: "format",
      label: "Format des frames",
      type: "select",
      default: "png",
      choices: [
        { value: "png", label: "PNG" },
        { value: "jpg", label: "JPG" },
      ],
    },
  ],
  async run(files, ctx) {
    const format = String(ctx.options.format ?? "png") as "png" | "jpg";
    const out: OutFile[] = [];
    for (const file of files) {
      const { frames } = await gifFrames(file);
      for (let i = 0; i < frames.length; i++) {
        ctx.onProgress(i / frames.length, `frame ${i + 1}/${frames.length}`);
        const source =
          format === "jpg"
            ? drawToCanvas(
                frames[i],
                frames[i].width,
                frames[i].height,
                "#ffffff",
              )
            : frames[i];
        out.push({
          name: `${baseOf(file.name)}-${pad(i + 1)}.${format}`,
          blob: await canvasToBlob(source, MIME[format], 0.92),
        });
      }
    }
    ctx.onProgress(1);
    return out;
  },
};

const gifToSprite: Converter = {
  id: "gif→sprite",
  to: "Sprite sheet",
  from: ["gif"],
  category: "images",
  description: "Assemble toutes les frames dans une seule grande image PNG.",
  options: [
    {
      id: "columns",
      label: "Colonnes (0 = une seule ligne)",
      type: "number",
      default: 0,
      min: 0,
      max: 64,
      step: 1,
    },
  ],
  async run(files, ctx) {
    const out: OutFile[] = [];
    for (const file of files) {
      const { frames, width, height } = await gifFrames(file);
      const requested = Number(ctx.options.columns ?? 0);
      const columns =
        requested > 0
          ? Math.min(requested, frames.length)
          : Math.min(frames.length, Math.ceil(Math.sqrt(frames.length)) || 1);
      const rows = Math.ceil(frames.length / columns);
      const sheet = document.createElement("canvas");
      sheet.width = columns * width;
      sheet.height = rows * height;
      const sctx = sheet.getContext("2d")!;
      frames.forEach((frame, i) => {
        ctx.onProgress(i / frames.length);
        sctx.drawImage(
          frame,
          (i % columns) * width,
          Math.floor(i / columns) * height,
        );
      });
      out.push({
        name: `${baseOf(file.name)}-sprite.png`,
        blob: await canvasToBlob(sheet, "image/png"),
      });
    }
    ctx.onProgress(1);
    return out;
  },
};

// Vectors, HEIC and TIFF all end up on the same canvas, so one pipeline
// handles them all — which also lets you drop a mixed batch at once.
const IMAGE_SOURCES = [...RASTER_IN, "tif", "tiff", "heic", "heif", "svg"];

export const imageConverters: Converter[] = [
  rasterConverter(
    IMAGE_SOURCES,
    "png",
    "Rasterise l'image dans un PNG sans perte (transparence conservée).",
    { scale: true },
  ),
  rasterConverter(
    IMAGE_SOURCES,
    "jpg",
    "Encode l'image en JPEG, avec un fond opaque à la place de la transparence.",
    { scale: true },
  ),
  rasterConverter(
    IMAGE_SOURCES,
    "webp",
    "Encode l'image en WebP, souvent 30 % plus léger qu'un JPEG.",
    { scale: true },
  ),
  gifToFrames,
  gifToSprite,
];
