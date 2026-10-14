import { LocalizedError } from "../i18n";
import type { Converter, OutFile } from "../types";
import { baseOf, bytesBlob, extOf } from "../utils";

/* ------------------------------------------------------------------ *
 *  Minimal TAR (ustar) reader / writer
 * ------------------------------------------------------------------ */

function writeString(block: Uint8Array, offset: number, value: string, size: number) {
  const bytes = new TextEncoder().encode(value);
  block.set(bytes.subarray(0, size - 1), offset);
}

function writeOctal(block: Uint8Array, offset: number, value: number, size: number) {
  writeString(block, offset, value.toString(8).padStart(size - 1, "0"), size);
}

function tarHeader(name: string, size: number, mtime: number): Uint8Array {
  const header = new Uint8Array(512);
  writeString(header, 0, name, 100);
  writeOctal(header, 100, 0o644, 8);
  writeOctal(header, 108, 0, 8);
  writeOctal(header, 116, 0, 8);
  writeOctal(header, 124, size, 12);
  writeOctal(header, 136, Math.floor(mtime / 1000), 12);
  header.fill(32, 148, 156); // checksum placeholder
  header[156] = 0x30; // '0' → regular file
  writeString(header, 257, "ustar", 6);
  header[263] = 0x30;
  header[264] = 0x30;
  let checksum = 0;
  for (const byte of header) checksum += byte;
  writeString(header, 148, `${checksum.toString(8).padStart(6, "0")}\0 `, 8);
  return header;
}

export function createTar(
  entries: { name: string; data: Uint8Array; mtime?: number }[],
): Uint8Array {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (const entry of entries) {
    const header = tarHeader(entry.name, entry.data.length, entry.mtime ?? Date.now());
    chunks.push(header, entry.data);
    total += 512 + entry.data.length;
    const padding = (512 - (entry.data.length % 512)) % 512;
    if (padding) {
      chunks.push(new Uint8Array(padding));
      total += padding;
    }
  }
  chunks.push(new Uint8Array(1024)); // two empty blocks terminate the archive
  total += 1024;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export function extractTar(
  data: Uint8Array,
): { name: string; data: Uint8Array }[] {
  const decoder = new TextDecoder();
  const entries: { name: string; data: Uint8Array }[] = [];
  let offset = 0;
  while (offset + 512 <= data.length) {
    const header = data.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;
    const rawName = decoder.decode(header.subarray(0, 100)).replace(/\0.*$/, "");
    const prefix = decoder.decode(header.subarray(345, 500)).replace(/\0.*$/, "");
    const sizeField = decoder
      .decode(header.subarray(124, 136))
      .replace(/[\0 ]/g, "");
    const size = parseInt(sizeField, 8) || 0;
    const typeFlag = String.fromCharCode(header[156] || 0x30);
    offset += 512;
    if (rawName && (typeFlag === "0" || typeFlag === "\0")) {
      entries.push({
        name: prefix ? `${prefix}/${rawName}` : rawName,
        data: data.slice(offset, offset + size),
      });
    }
    offset += Math.ceil(size / 512) * 512;
  }
  return entries;
}

/* ------------------------------------------------------------------ *
 *  Converters
 * ------------------------------------------------------------------ */

function uniqueNames(files: File[]) {
  const seen = new Map<string, number>();
  return files.map((file) => {
    const count = seen.get(file.name) ?? 0;
    seen.set(file.name, count + 1);
    if (count === 0) return file.name;
    return `${baseOf(file.name)} (${count}).${extOf(file.name)}`;
  });
}

function mimeFor(name: string): string {
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    pdf: "application/pdf",
    json: "application/json",
    txt: "text/plain",
    csv: "text/csv",
    html: "text/html",
    xml: "application/xml",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    zip: "application/zip",
  };
  return map[extOf(name)] ?? "application/octet-stream";
}

export const archiveConverters: Converter[] = [
  {
    id: "files→zip",
    to: "ZIP",
    from: ["*"],
    category: "archives",
    batch: true,
    description: {
      fr: "Compresse tous les fichiers sélectionnés dans une archive ZIP.",
      en: "Compresses every selected file into a ZIP archive.",
    },
    options: [
      {
        id: "level",
        label: "Compression",
        type: "select",
        default: "6",
        choices: [
          { value: "9", label: { fr: "Maximale (lent)", en: "Maximum (slow)" } },
          { value: "6", label: { fr: "Équilibrée — recommandé", en: "Balanced — recommended" } },
          { value: "0", label: { fr: "Aucune (stockage brut)", en: "None (store only)" } },
        ],
      },
    ],
    async run(files, ctx) {
      const { zipSync } = await import("fflate");
      const level = Number(ctx.options.level ?? 6) as 0 | 6 | 9;
      const names = uniqueNames(files);
      const payload: Record<string, Uint8Array> = {};
      for (let i = 0; i < files.length; i++) {
        ctx.onProgress((i / files.length) * 0.8, files[i].name);
        payload[names[i]] = new Uint8Array(await files[i].arrayBuffer());
      }
      ctx.onProgress(0.85, { fr: "Compression…", en: "Compressing…" });
      const zipped = zipSync(payload, { level });
      ctx.onProgress(1);
      return [
        {
          name: "archive.zip",
          blob: bytesBlob(zipped, "application/zip"),
        },
      ];
    },
  },
  {
    id: "files→tar",
    to: "TAR",
    from: ["*"],
    category: "archives",
    batch: true,
    description: {
      fr: "Regroupe les fichiers dans une archive TAR (non compressée).",
      en: "Bundles the files into an (uncompressed) TAR archive.",
    },
    options: [
      {
        id: "gzip",
        label: { fr: "Compresser en .tar.gz", en: "Compress as .tar.gz" },
        type: "boolean",
        default: false,
      },
    ],
    async run(files, ctx) {
      const names = uniqueNames(files);
      const entries: { name: string; data: Uint8Array }[] = [];
      for (let i = 0; i < files.length; i++) {
        ctx.onProgress((i / files.length) * 0.8, files[i].name);
        entries.push({
          name: names[i],
          data: new Uint8Array(await files[i].arrayBuffer()),
        });
      }
      let data = createTar(entries);
      let name = "archive.tar";
      if (ctx.options.gzip) {
        ctx.onProgress(0.85, { fr: "Compression gzip…", en: "Compressing with gzip…" });
        const { gzipSync } = await import("fflate");
        data = gzipSync(data, { level: 6 });
        name = "archive.tar.gz";
      }
      ctx.onProgress(1);
      return [
        {
          name,
          blob: bytesBlob(data, ctx.options.gzip ? "application/gzip" : "application/x-tar"),
        },
      ];
    },
  },
  {
    id: "zip→files",
    to: { fr: "Fichiers extraits", en: "Extracted files" },
    from: ["zip"],
    category: "archives",
    multiOutput: true,
    description: {
      fr: "Décompresse l'archive entièrement dans la mémoire du navigateur.",
      en: "Unpacks the whole archive in the browser’s memory.",
    },
    async run(files, ctx) {
      const { unzipSync } = await import("fflate");
      const out: OutFile[] = [];
      for (let i = 0; i < files.length; i++) {
        ctx.onProgress(i / files.length, files[i].name);
        const unzipped = unzipSync(new Uint8Array(await files[i].arrayBuffer()));
        for (const [name, data] of Object.entries(unzipped)) {
          if (name.endsWith("/") || data.length === 0) continue;
          out.push({
            name: name.split("/").pop() || name,
            blob: bytesBlob(data, mimeFor(name)),
          });
        }
      }
      ctx.onProgress(1);
      if (!out.length) {
        throw new LocalizedError({
          fr: "Archive vide ou illisible.",
          en: "Empty or unreadable archive.",
        });
      }
      return out;
    },
  },
  {
    id: "tar→files",
    to: { fr: "Fichiers extraits", en: "Extracted files" },
    from: ["tar", "gz", "tgz"],
    category: "archives",
    multiOutput: true,
    description: {
      fr: "Extrait un .tar, .tar.gz ou .tgz — un simple .gz est simplement décompressé.",
      en: "Extracts a .tar, .tar.gz or .tgz — a plain .gz is simply decompressed.",
    },
    async run(files, ctx) {
      const { gunzipSync } = await import("fflate");
      const out: OutFile[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        ctx.onProgress(i / files.length, file.name);
        let data = new Uint8Array(await file.arrayBuffer());
        const gzipped = data[0] === 0x1f && data[1] === 0x8b;
        if (gzipped) data = gunzipSync(data);

        const looksLikeTar =
          data.length > 262 &&
          String.fromCharCode(...data.subarray(257, 262)) === "ustar";
        if (looksLikeTar) {
          for (const entry of extractTar(data)) {
            out.push({
              name: entry.name.split("/").pop() || entry.name,
              blob: bytesBlob(entry.data, mimeFor(entry.name)),
            });
          }
        } else {
          const name = file.name.replace(/\.(gz|tgz)$/i, "") || baseOf(file.name);
          out.push({
            name: name === file.name ? `${baseOf(file.name)}.out` : name,
            blob: bytesBlob(data, mimeFor(name)),
          });
        }
      }
      ctx.onProgress(1);
      if (!out.length) {
        throw new LocalizedError({
          fr: "Aucun fichier trouvé dans l'archive.",
          en: "No files found in the archive.",
        });
      }
      return out;
    },
  },
  {
    id: "files→gz",
    to: "GZIP (.gz)",
    from: ["*"],
    category: "archives",
    description: {
      fr: "Compresse chaque fichier individuellement en gzip.",
      en: "Gzips each file individually.",
    },
    async run(files, ctx) {
      const { gzipSync } = await import("fflate");
      const out: OutFile[] = [];
      for (let i = 0; i < files.length; i++) {
        ctx.onProgress(i / files.length, files[i].name);
        const data = gzipSync(new Uint8Array(await files[i].arrayBuffer()), {
          level: 6,
          filename: files[i].name,
        });
        out.push({
          name: `${files[i].name}.gz`,
          blob: bytesBlob(data, "application/gzip"),
        });
      }
      ctx.onProgress(1);
      return out;
    },
  },
];
