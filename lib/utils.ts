import { LocalizedError, type Locale } from "./i18n";

export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i + 1).toLowerCase();
}

export function baseOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? name : name.slice(0, i);
}

const SIZE_UNITS: Record<Locale, string[]> = {
  fr: ["o", "Ko", "Mo", "Go", "To"],
  en: ["B", "KB", "MB", "GB", "TB"],
};

export function humanSize(bytes: number, locale: Locale): string {
  const [byte, ...units] = SIZE_UNITS[locale];
  if (bytes < 1024) return `${bytes} ${byte}`;
  let v = bytes / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[u]}`;
}

export function pad(n: number, width = 3): string {
  return String(n).padStart(width, "0");
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function downloadAllAsZip(
  files: { name: string; blob: Blob }[],
  zipName = "conversions.zip",
) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const seen = new Map<string, number>();
  for (const f of files) {
    let name = f.name;
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    if (count > 0) {
      const dot = name.lastIndexOf(".");
      name =
        dot === -1
          ? `${name} (${count})`
          : `${name.slice(0, dot)} (${count})${name.slice(dot)}`;
    }
    zip.file(name, f.blob);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  download(blob, zipName);
}

export function textBlob(text: string, mime = "text/plain;charset=utf-8") {
  return new Blob([text], { type: mime });
}

export async function readAsText(file: Blob): Promise<string> {
  return await file.text();
}

export async function readAsArrayBuffer(file: Blob): Promise<ArrayBuffer> {
  return await file.arrayBuffer();
}

export async function readAsDataURL(file: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new LocalizedError({ fr: "Encodage impossible", en: "Encoding failed" }))),
      type,
      quality,
    );
  });
}

/** Loads a bitmap from a Blob, using createImageBitmap when available. */
export async function loadBitmap(
  blob: Blob,
): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(blob);
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new LocalizedError({ fr: "Image illisible", en: "Unreadable image" }));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

export function drawToCanvas(
  source: CanvasImageSource,
  width: number,
  height: number,
  background?: string,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d")!;
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Wraps a body fragment in a printable standalone HTML document. */
export function wrapHtmlDocument(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #111; max-width: 46rem; margin: 2rem auto; padding: 0 1.25rem; }
  h1, h2, h3 { line-height: 1.25; }
  img { max-width: 100%; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #d4d4d8; padding: 6px 10px; text-align: left; }
  th { background: #f4f4f5; }
  pre { background: #f4f4f5; padding: 1rem; overflow-x: auto; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  blockquote { border-left: 3px solid #d4d4d8; margin-left: 0; padding-left: 1rem; color: #52525b; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

/** Wraps raw bytes in a Blob, detached from any pooled/shared buffer. */
export function bytesBlob(data: Uint8Array, type: string): Blob {
  const copy = new Uint8Array(data.length);
  copy.set(data);
  return new Blob([copy.buffer as ArrayBuffer], { type });
}

/** Copies raw RGBA bytes into an ImageData backed by a plain ArrayBuffer. */
export function toImageData(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  data.set(rgba);
  return new ImageData(data, width, height);
}

/** Appends " (2)", " (3)"… so two results never share a filename. */
export function dedupeNames<T extends { name: string }>(files: T[]): T[] {
  const seen = new Map<string, number>();
  return files.map((file) => {
    const count = seen.get(file.name) ?? 0;
    seen.set(file.name, count + 1);
    if (count === 0) return file;
    const dot = file.name.lastIndexOf(".");
    const name =
      dot === -1
        ? `${file.name} (${count + 1})`
        : `${file.name.slice(0, dot)} (${count + 1})${file.name.slice(dot)}`;
    return { ...file, name };
  });
}
