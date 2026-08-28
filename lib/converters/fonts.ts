import type { Converter, OutFile } from "../types";
import { baseOf, bytesBlob } from "../utils";

type SfntTable = {
  tag: string;
  checksum: number;
  offset: number;
  length: number;
};

function readSfnt(data: Uint8Array) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const flavor = view.getUint32(0);
  if (flavor === 0x74746366) {
    throw new Error("Les collections de polices (.ttc) ne sont pas supportées.");
  }
  const numTables = view.getUint16(4);
  const tables: SfntTable[] = [];
  for (let i = 0; i < numTables; i++) {
    const base = 12 + i * 16;
    tables.push({
      tag: String.fromCharCode(
        data[base],
        data[base + 1],
        data[base + 2],
        data[base + 3],
      ),
      checksum: view.getUint32(base + 4),
      offset: view.getUint32(base + 8),
      length: view.getUint32(base + 12),
    });
  }
  return { flavor, tables };
}

const align4 = (n: number) => (n + 3) & ~3;

/** Packs an OpenType/TrueType font into the WOFF 1.0 container. */
async function ttfToWoff(data: Uint8Array): Promise<Uint8Array> {
  const { zlibSync } = await import("fflate");
  const { flavor, tables } = readSfnt(data);
  const numTables = tables.length;

  const entries = tables.map((table) => {
    const raw = data.subarray(table.offset, table.offset + table.length);
    const compressed = zlibSync(raw, { level: 9 });
    const useCompressed = compressed.length < raw.length;
    return {
      table,
      payload: useCompressed ? compressed : raw,
      origLength: raw.length,
    };
  });

  const directorySize = 44 + numTables * 20;
  let dataSize = 0;
  for (const entry of entries) dataSize += align4(entry.payload.length);
  const totalLength = directorySize + dataSize;

  const totalSfntSize =
    12 +
    numTables * 16 +
    tables.reduce((sum, table) => sum + align4(table.length), 0);

  const out = new Uint8Array(totalLength);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x774f4646); // 'wOFF'
  view.setUint32(4, flavor);
  view.setUint32(8, totalLength);
  view.setUint16(12, numTables);
  view.setUint16(14, 0);
  view.setUint32(16, totalSfntSize);
  view.setUint16(20, 1); // major version
  view.setUint16(22, 0); // minor version
  // metaOffset/metaLength/metaOrigLength/privOffset/privLength stay zero.

  let offset = directorySize;
  entries.forEach((entry, i) => {
    const base = 44 + i * 20;
    for (let c = 0; c < 4; c++) out[base + c] = entry.table.tag.charCodeAt(c);
    view.setUint32(base + 4, offset);
    view.setUint32(base + 8, entry.payload.length);
    view.setUint32(base + 12, entry.origLength);
    view.setUint32(base + 16, entry.table.checksum);
    out.set(entry.payload, offset);
    offset += align4(entry.payload.length);
  });

  return out;
}

/** Unpacks a WOFF 1.0 container back into a plain .ttf/.otf. */
async function woffToTtf(data: Uint8Array): Promise<Uint8Array> {
  const { unzlibSync } = await import("fflate");
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (view.getUint32(0) !== 0x774f4646) throw new Error("Ce n'est pas un WOFF.");
  const flavor = view.getUint32(4);
  const numTables = view.getUint16(12);

  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const base = 44 + i * 20;
    const compLength = view.getUint32(base + 8);
    const origLength = view.getUint32(base + 12);
    const offset = view.getUint32(base + 4);
    const raw = data.subarray(offset, offset + compLength);
    tables.push({
      tag: String.fromCharCode(
        data[base],
        data[base + 1],
        data[base + 2],
        data[base + 3],
      ),
      checksum: view.getUint32(base + 16),
      data: compLength === origLength ? raw : unzlibSync(raw),
    });
  }
  tables.sort((a, b) => (a.tag < b.tag ? -1 : 1));

  const headerSize = 12 + numTables * 16;
  const total =
    headerSize + tables.reduce((sum, t) => sum + align4(t.data.length), 0);
  const out = new Uint8Array(total);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, flavor);
  outView.setUint16(4, numTables);
  const maxPower = Math.floor(Math.log2(numTables));
  outView.setUint16(6, 16 * 2 ** maxPower);
  outView.setUint16(8, maxPower);
  outView.setUint16(10, numTables * 16 - 16 * 2 ** maxPower);

  let offset = headerSize;
  tables.forEach((table, i) => {
    const base = 12 + i * 16;
    for (let c = 0; c < 4; c++) out[base + c] = table.tag.charCodeAt(c);
    outView.setUint32(base + 4, table.checksum);
    outView.setUint32(base + 8, offset);
    outView.setUint32(base + 12, table.data.length);
    out.set(table.data, offset);
    offset += align4(table.data.length);
  });
  return out;
}

type WawoffModule = {
  calledRun?: boolean;
  onRuntimeInitialized?: () => void;
  compress?: (data: Uint8Array) => Uint8Array | false;
  decompress?: (data: Uint8Array) => Uint8Array | false;
};

const scriptCache = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  let pending = scriptCache.get(src);
  if (!pending) {
    pending = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Chargement impossible : ${src}`));
      document.head.appendChild(script);
    });
    scriptCache.set(src, pending);
  }
  return pending;
}

/**
 * Loads one of the wawoff2 Emscripten builds staged in public/wawoff2 and
 * waits for its runtime to finish booting.
 */
async function wawoff(kind: "compress" | "decompress"): Promise<WawoffModule> {
  const key = `__wawoff2_${kind}` as const;
  const scope = window as unknown as Record<string, WawoffModule | undefined>;
  if (!scope[key]) await loadScript(`/wawoff2/${kind}.js`);
  const wasmModule = scope[key];
  if (!wasmModule) throw new Error("Moteur WOFF2 indisponible.");
  if (!wasmModule.calledRun) {
    await new Promise<void>((resolve) => {
      const previous = wasmModule.onRuntimeInitialized;
      wasmModule.onRuntimeInitialized = () => {
        previous?.();
        resolve();
      };
      if (wasmModule.calledRun) resolve();
    });
  }
  return wasmModule;
}

async function woff2Compress(data: Uint8Array): Promise<Uint8Array> {
  const { compress } = await wawoff("compress");
  const result = compress?.(data);
  if (!result) throw new Error("Cette police n'a pas pu être compressée en WOFF2.");
  return result;
}

async function woff2Decompress(data: Uint8Array): Promise<Uint8Array> {
  const { decompress } = await wawoff("decompress");
  const result = decompress?.(data);
  if (!result) throw new Error("Ce WOFF2 n'a pas pu être décompressé.");
  return result;
}

function each(
  handler: (file: File) => Promise<OutFile[]>,
): Converter["run"] {
  return async (files, ctx) => {
    const out: OutFile[] = [];
    for (let i = 0; i < files.length; i++) {
      ctx.onProgress(i / files.length, files[i].name);
      out.push(...(await handler(files[i])));
    }
    ctx.onProgress(1);
    return out;
  };
}

const fontBlob = (data: Uint8Array, mime: string) => bytesBlob(data, mime);

export const fontConverters: Converter[] = [
  {
    id: "ttf→woff",
    to: "WOFF",
    from: ["ttf", "otf"],
    category: "fonts",
    description: "Emballe la police dans le conteneur WOFF 1.0 (zlib).",
    run: each(async (file) => [
      {
        name: `${baseOf(file.name)}.woff`,
        blob: fontBlob(
          await ttfToWoff(new Uint8Array(await file.arrayBuffer())),
          "font/woff",
        ),
      },
    ]),
  },
  {
    id: "ttf→woff2",
    to: "WOFF2",
    from: ["ttf", "otf"],
    category: "fonts",
    description:
      "Compression Brotli du format WOFF2 : jusqu'à 30 % plus léger qu'un WOFF.",
    run: each(async (file) => [
      {
        name: `${baseOf(file.name)}.woff2`,
        blob: fontBlob(
          await woff2Compress(new Uint8Array(await file.arrayBuffer())),
          "font/woff2",
        ),
      },
    ]),
  },
  {
    id: "woff→ttf",
    to: "TTF",
    from: ["woff"],
    category: "fonts",
    description: "Décompresse un WOFF vers la police TrueType d'origine.",
    run: each(async (file) => [
      {
        name: `${baseOf(file.name)}.ttf`,
        blob: fontBlob(
          await woffToTtf(new Uint8Array(await file.arrayBuffer())),
          "font/ttf",
        ),
      },
    ]),
  },
  {
    id: "woff2→ttf",
    to: "TTF",
    from: ["woff2"],
    category: "fonts",
    description: "Décompresse un WOFF2 vers la police TrueType d'origine.",
    run: each(async (file) => [
      {
        name: `${baseOf(file.name)}.ttf`,
        blob: fontBlob(
          await woff2Decompress(new Uint8Array(await file.arrayBuffer())),
          "font/ttf",
        ),
      },
    ]),
  },
  {
    id: "woff→woff2",
    to: "WOFF2",
    from: ["woff"],
    category: "fonts",
    description: "Ré-encode un WOFF en WOFF2 (via la police TrueType interne).",
    run: each(async (file) => {
      const ttf = await woffToTtf(new Uint8Array(await file.arrayBuffer()));
      return [
        {
          name: `${baseOf(file.name)}.woff2`,
          blob: fontBlob(await woff2Compress(ttf), "font/woff2"),
        },
      ];
    }),
  },
];
