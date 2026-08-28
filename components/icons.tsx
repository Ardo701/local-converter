import type { Category } from "@/lib/types";

const EXTENSION_CATEGORY: Record<string, Category> = {};
const register = (category: Category, extensions: string[]) => {
  for (const ext of extensions) EXTENSION_CATEGORY[ext] = category;
};

register("documents", ["pdf", "docx", "doc", "md", "markdown", "mdown", "html", "htm", "rtf", "txt", "log"]);
register("data", ["xlsx", "xls", "xlsm", "ods", "csv", "tsv", "json", "xml", "rss", "atom"]);
register("images", ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg", "heic", "heif", "tif", "tiff", "avif", "ico"]);
register("audio", ["mp3", "wav", "ogg", "oga", "opus", "flac", "aac", "m4a", "wma", "aiff", "aif", "amr", "weba"]);
register("video", ["mp4", "webm", "mkv", "avi", "mov", "m4v", "mpg", "mpeg", "wmv", "flv", "3gp", "ogv", "ts", "m2ts"]);
register("archives", ["zip", "tar", "gz", "tgz"]);
register("fonts", ["ttf", "otf", "woff", "woff2"]);
register("3d", ["obj", "stl", "gltf", "glb"]);
register("code", ["scss", "sass", "less", "ts", "tsx", "jsx", "mts", "cts"]);

export function categoryOfExtension(ext: string): Category | null {
  return EXTENSION_CATEGORY[ext] ?? null;
}
