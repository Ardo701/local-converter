import type { Category, Converter } from "./types";
import { extOf } from "./utils";
import { documentConverters } from "./converters/documents";
import { dataConverters } from "./converters/data";
import { imageConverters } from "./converters/images";
import { audioConverters, videoConverters } from "./converters/media";
import { transcriptionConverters } from "./converters/transcribe";
import { archiveConverters } from "./converters/archives";
import { fontConverters } from "./converters/fonts";
import { threeConverters } from "./converters/three";
import { codeConverters } from "./converters/code";

export const converters: Converter[] = [
  ...documentConverters,
  ...dataConverters,
  ...imageConverters,
  ...audioConverters,
  ...transcriptionConverters,
  ...videoConverters,
  ...archiveConverters,
  ...fontConverters,
  ...threeConverters,
  ...codeConverters,
];

export const converterById = new Map(converters.map((c) => [c.id, c]));

/** Every extension the app knows how to read, sorted for display. */
export const supportedExtensions: string[] = [
  ...new Set(converters.flatMap((c) => c.from).filter((e) => e !== "*")),
].sort();

export const acceptAttribute = supportedExtensions
  .map((ext) => `.${ext}`)
  .join(",");

export function isSupported(fileName: string): boolean {
  return supportedExtensions.includes(extOf(fileName));
}

/** Converters that can handle *every* file in the selection. */
export function matchingConverters(files: { name: string }[]): Converter[] {
  if (!files.length) return [];
  const extensions = [...new Set(files.map((f) => extOf(f.name)))];
  return converters.filter(
    (converter) =>
      files.length >= (converter.minFiles ?? 1) &&
      extensions.every(
        (ext) => converter.from.includes("*") || converter.from.includes(ext),
      ),
  );
}

export function convertersByCategory(): Record<Category, Converter[]> {
  const grouped = {} as Record<Category, Converter[]>;
  for (const converter of converters) {
    (grouped[converter.category] ??= []).push(converter);
  }
  return grouped;
}

/** Source formats a converter accepts, formatted for the catalogue. */
export function sourceLabel(converter: Converter): string {
  if (converter.from.includes("*")) return "N'importe quel fichier";
  const shown = converter.from.slice(0, 6).map((e) => e.toUpperCase());
  const extra = converter.from.length - shown.length;
  return shown.join(", ") + (extra > 0 ? ` +${extra}` : "");
}
