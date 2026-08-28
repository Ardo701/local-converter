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
      label: string;
      type: "select";
      default: string;
      choices: { value: string; label: string }[];
    }
  | {
      id: string;
      label: string;
      type: "number";
      default: number;
      min?: number;
      max?: number;
      step?: number;
      suffix?: string;
    }
  | {
      id: string;
      label: string;
      type: "range";
      default: number;
      min: number;
      max: number;
      step?: number;
      suffix?: string;
    }
  | {
      id: string;
      label: string;
      type: "boolean";
      default: boolean;
    };

export type ConvertContext = {
  /** 0 → 1 */
  onProgress: (ratio: number, message?: string) => void;
  options: Record<string, string | number | boolean>;
  signal?: AbortSignal;
};

export type Converter = {
  /** unique id, e.g. "pdf→png" */
  id: string;
  /** target format shown in the UI */
  to: string;
  /** accepted source extensions, lowercase and without the dot */
  from: string[];
  category: Category;
  /** short human explanation */
  description: string;
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

export const CATEGORY_META: Record<Category, { label: string; code: string }> = {
  documents: { label: "Documents", code: "DOC" },
  data: { label: "Tableurs et données", code: "DAT" },
  images: { label: "Images", code: "IMG" },
  audio: { label: "Audio", code: "AUD" },
  video: { label: "Vidéo", code: "VID" },
  archives: { label: "Archives", code: "ARC" },
  fonts: { label: "Polices", code: "FNT" },
  "3d": { label: "Modèles 3D", code: "3D" },
  code: { label: "Code source", code: "SRC" },
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
