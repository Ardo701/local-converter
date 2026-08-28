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

export const CATEGORY_META: Record<
  Category,
  { label: string; accent: string; icon: string }
> = {
  documents: { label: "Documents", accent: "#6366f1", icon: "FileText" },
  data: { label: "Tableurs & Données", accent: "#10b981", icon: "Table" },
  images: { label: "Images", accent: "#f59e0b", icon: "Image" },
  audio: { label: "Audio", accent: "#ec4899", icon: "AudioLines" },
  video: { label: "Vidéo", accent: "#8b5cf6", icon: "Clapperboard" },
  archives: { label: "Archives", accent: "#0ea5e9", icon: "FileArchive" },
  fonts: { label: "Polices", accent: "#f43f5e", icon: "Type" },
  "3d": { label: "3D", accent: "#22d3ee", icon: "Box" },
  code: { label: "Code", accent: "#a3e635", icon: "Code2" },
};
