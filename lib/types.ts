import type { Localized } from "./i18n";

export type Category =
  | "documents"
  | "data"
  | "images"
  | "audio"
  | "video"
  | "archives"
  | "fonts"
  | "3d"
  | "code";

export type OutFile = {
  name: string;
  blob: Blob;
};

export type OptionDef =
  | {
      id: string;
      label: Localized;
      type: "select";
      /** may differ per language, e.g. the spoken language for Whisper */
      default: Localized;
      choices: { value: string; label: Localized }[];
    }
  | {
      id: string;
      label: Localized;
      type: "number";
      default: number;
      min?: number;
      max?: number;
      step?: number;
      suffix?: string;
    }
  | {
      id: string;
      label: Localized;
      type: "range";
      default: number;
      min: number;
      max: number;
      step?: number;
      suffix?: string;
    }
  | {
      id: string;
      label: Localized;
      type: "boolean";
      default: boolean;
    };

export type ConvertContext = {
  /** 0 → 1 */
  onProgress: (ratio: number, message?: Localized) => void;
  options: Record<string, string | number | boolean>;
  signal?: AbortSignal;
};

export type Converter = {
  /** unique id, e.g. "pdf→png" */
  id: string;
  /** target format shown in the UI */
  to: Localized;
  /** accepted source extensions, lowercase and without the dot */
  from: string[];
  category: Category;
  /** short human explanation */
  description: Localized;
  /** consumes every selected file at once instead of one by one */
  batch?: boolean;
  /** hidden unless at least this many files are selected */
  minFiles?: number;
  /** downloads a large WebAssembly payload on first use */
  heavy?: boolean;
  /** may emit several files for one input */
  multiOutput?: boolean;
  options?: OptionDef[];
  run: (files: File[], ctx: ConvertContext) => Promise<OutFile[]>;
};

export const CATEGORY_META: Record<Category, { label: Localized; code: string }> = {
  documents: { label: "Documents", code: "DOC" },
  data: {
    label: { fr: "Tableurs et données", en: "Spreadsheets and data" },
    code: "DAT",
  },
  images: { label: "Images", code: "IMG" },
  audio: { label: "Audio", code: "AUD" },
  video: { label: { fr: "Vidéo", en: "Video" }, code: "VID" },
  archives: { label: "Archives", code: "ARC" },
  fonts: { label: { fr: "Polices", en: "Fonts" }, code: "FNT" },
  "3d": { label: { fr: "Modèles 3D", en: "3D models" }, code: "3D" },
  code: { label: { fr: "Code source", en: "Source code" }, code: "SRC" },
};

/** Display order for the catalogue and the format list. */
export const CATEGORY_ORDER: Category[] = [
  "documents",
  "data",
  "images",
  "audio",
  "video",
  "archives",
  "fonts",
  "3d",
  "code",
];
