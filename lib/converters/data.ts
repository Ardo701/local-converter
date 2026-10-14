import type { Converter, OutFile } from "../types";
import { baseOf, escapeHtml, textBlob, wrapHtmlDocument } from "../utils";

type Row = Record<string, unknown>;

/* ------------------------------------------------------------------ *
 *  Helpers
 * ------------------------------------------------------------------ */

async function sheetjs() {
  return await import("xlsx");
}

async function parseCsv(text: string): Promise<Row[]> {
  const Papa = (await import("papaparse")).default;
  const result = Papa.parse<Row>(text, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: "greedy",
  });
  return result.data.filter((r) => r && typeof r === "object");
}

async function toCsv(rows: Row[], delimiter: string): Promise<string> {
  const Papa = (await import("papaparse")).default;
  return Papa.unparse(rows, { delimiter, newline: "\r\n" });
}

/** Flattens `{a:{b:1}}` into `{"a.b":1}` so nested JSON fits a table. */
function flatten(value: unknown, prefix = "", out: Row = {}): Row {
  if (value === null || value === undefined) {
    out[prefix || "value"] = "";
    return out;
  }
  if (Array.isArray(value)) {
    if (value.every((v) => v === null || typeof v !== "object")) {
      out[prefix || "value"] = value.join(", ");
    } else {
      value.forEach((v, i) => flatten(v, prefix ? `${prefix}[${i}]` : `[${i}]`, out));
    }
    return out;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Row)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
    return out;
  }
  out[prefix || "value"] = value;
  return out;
}

/** Walks the whole tree and returns the largest array of records it finds. */
function findRecordArray(data: unknown): unknown[] | null {
  let best: unknown[] | null = null;
  const visit = (node: unknown, depth: number) => {
    if (depth > 8 || node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      const records = node.filter((item) => item && typeof item === "object");
      if (records.length && (!best || node.length > best.length)) best = node;
      for (const item of node) visit(item, depth + 1);
      return;
    }
    for (const value of Object.values(node as Row)) visit(value, depth + 1);
  };
  visit(data, 0);
  return best;
}

/** Finds the most table-like array inside an arbitrary JSON structure. */
function tabularize(data: unknown): Row[] {
  if (Array.isArray(data)) {
    return data.map((item) =>
      item && typeof item === "object" ? flatten(item) : { value: item as never },
    );
  }
  if (data && typeof data === "object") {
    const records = findRecordArray(data);
    if (records) return tabularize(records);
    return [flatten(data)];
  }
  return [{ value: data as never }];
}

function columnsOf(rows: Row[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) for (const key of Object.keys(row)) seen.add(key);
  return [...seen];
}

function rowsToHtmlTable(rows: Row[], title: string): string {
  const columns = columnsOf(rows);
  const head = columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("");
  const body = rows
    .map(
      (row) =>
        `<tr>${columns
          .map((c) => `<td>${escapeHtml(String(row[c] ?? ""))}</td>`)
          .join("")}</tr>`,
    )
    .join("\n");
  return wrapHtmlDocument(
    title,
    `<h1>${escapeHtml(title)}</h1>\n<table>\n<thead><tr>${head}</tr></thead>\n<tbody>\n${body}\n</tbody>\n</table>`,
  );
}

function xmlTagName(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9_.-]/g, "_");
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `_${cleaned}`;
}

function rowsToXml(rows: Row[], rootName: string): string {
  const escapeXml = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const body = rows
    .map((row) => {
      const cells = Object.entries(row)
        .map(
          ([k, v]) =>
            `    <${xmlTagName(k)}>${escapeXml(String(v ?? ""))}</${xmlTagName(k)}>`,
        )
        .join("\n");
      return `  <row>\n${cells}\n  </row>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<${xmlTagName(
    rootName,
  )}>\n${body}\n</${xmlTagName(rootName)}>\n`;
}

async function rowsToXlsxBlob(sheets: { name: string; rows: Row[] }[]): Promise<Blob> {
  const XLSX = await sheetjs();
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows);
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      sheet.name.slice(0, 31) || "Feuille1",
    );
  }
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

async function readWorkbook(file: File) {
  const XLSX = await sheetjs();
  return XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
}

async function parseXml(text: string): Promise<unknown> {
  const { XMLParser } = await import("fast-xml-parser");
  const parser = new XMLParser({
    ignoreDeclaration: true,
    ignoreAttributes: false,
    attributeNamePrefix: "@",
    parseAttributeValue: true,
    trimValues: true,
  });
  return parser.parse(text);
}

const DELIMITER_OPTION = {
  id: "delimiter",
  label: { fr: "Séparateur", en: "Delimiter" },
  type: "select" as const,
  default: ",",
  choices: [
    { value: ",", label: { fr: "Virgule (,)", en: "Comma (,)" } },
    {
      value: ";",
      label: {
        fr: "Point-virgule (;) — Excel FR",
        en: "Semicolon (;) — European Excel",
      },
    },
    { value: "\t", label: { fr: "Tabulation", en: "Tab" } },
    { value: "|", label: "Pipe (|)" },
  ],
};

function each(
  handler: (file: File, ctx: Parameters<Converter["run"]>[1]) => Promise<OutFile[]>,
): Converter["run"] {
  return async (files, ctx) => {
    const out: OutFile[] = [];
    for (let i = 0; i < files.length; i++) {
      ctx.onProgress(i / files.length, files[i].name);
      out.push(...(await handler(files[i], ctx)));
    }
    ctx.onProgress(1);
    return out;
  };
}

const SHEET_IN = ["xlsx", "xls", "xlsm", "ods"];

/* ------------------------------------------------------------------ *
 *  Converters
 * ------------------------------------------------------------------ */

export const dataConverters: Converter[] = [
  {
    id: "sheet→csv",
    to: "CSV",
    from: SHEET_IN,
    category: "data",
    description: {
      fr: "Un fichier CSV par feuille du classeur.",
      en: "One CSV file per worksheet.",
    },
    multiOutput: true,
    options: [DELIMITER_OPTION],
    run: each(async (file, ctx) => {
      const XLSX = await sheetjs();
      const workbook = await readWorkbook(file);
      const delimiter = String(ctx.options.delimiter ?? ",");
      return workbook.SheetNames.map((name) => ({
        name:
          workbook.SheetNames.length > 1
            ? `${baseOf(file.name)}-${name}.csv`
            : `${baseOf(file.name)}.csv`,
        blob: textBlob(
          XLSX.utils.sheet_to_csv(workbook.Sheets[name], { FS: delimiter }),
          "text/csv;charset=utf-8",
        ),
      }));
    }),
  },
  {
    id: "sheet→json",
    to: "JSON",
    from: SHEET_IN,
    category: "data",
    description: {
      fr: "Chaque feuille devient un tableau d'objets.",
      en: "Each sheet becomes an array of objects.",
    },
    run: each(async (file) => {
      const XLSX = await sheetjs();
      const workbook = await readWorkbook(file);
      const payload: Record<string, Row[]> = {};
      for (const name of workbook.SheetNames) {
        payload[name] = XLSX.utils.sheet_to_json<Row>(workbook.Sheets[name], {
          defval: null,
        });
      }
      const single = workbook.SheetNames.length === 1;
      return [
        {
          name: `${baseOf(file.name)}.json`,
          blob: textBlob(
            JSON.stringify(
              single ? payload[workbook.SheetNames[0]] : payload,
              null,
              2,
            ),
            "application/json",
          ),
        },
      ];
    }),
  },
  {
    id: "sheet→html",
    to: "HTML",
    from: SHEET_IN,
    category: "data",
    description: {
      fr: "Le classeur rendu sous forme de tableaux HTML.",
      en: "The workbook rendered as HTML tables.",
    },
    run: each(async (file) => {
      const XLSX = await sheetjs();
      const workbook = await readWorkbook(file);
      const sections = workbook.SheetNames.map(
        (name) =>
          `<h2>${escapeHtml(name)}</h2>\n${XLSX.utils.sheet_to_html(
            workbook.Sheets[name],
          )}`,
      ).join("\n");
      return [
        {
          name: `${baseOf(file.name)}.html`,
          blob: new Blob([wrapHtmlDocument(baseOf(file.name), sections)], {
            type: "text/html;charset=utf-8",
          }),
        },
      ];
    }),
  },
  {
    id: "sheet→xml",
    to: "XML",
    from: SHEET_IN,
    category: "data",
    description: {
      fr: "Chaque ligne devient un élément <row>.",
      en: "Each row becomes a <row> element.",
    },
    run: each(async (file) => {
      const XLSX = await sheetjs();
      const workbook = await readWorkbook(file);
      const rows = XLSX.utils.sheet_to_json<Row>(
        workbook.Sheets[workbook.SheetNames[0]],
        { defval: "" },
      );
      return [
        {
          name: `${baseOf(file.name)}.xml`,
          blob: textBlob(rowsToXml(rows, "workbook"), "application/xml"),
        },
      ];
    }),
  },
  {
    id: "csv→json",
    to: "JSON",
    from: ["csv", "tsv"],
    category: "data",
    description: {
      fr: "En-têtes détectés automatiquement, types numériques inférés.",
      en: "Headers detected automatically, numeric types inferred.",
    },
    run: each(async (file) => [
      {
        name: `${baseOf(file.name)}.json`,
        blob: textBlob(
          JSON.stringify(await parseCsv(await file.text()), null, 2),
          "application/json",
        ),
      },
    ]),
  },
  {
    id: "csv→xlsx",
    to: "Excel (.xlsx)",
    from: ["csv", "tsv"],
    category: "data",
    description: {
      fr: "Un vrai classeur Excel, prêt à ouvrir.",
      en: "A real Excel workbook, ready to open.",
    },
    run: each(async (file) => [
      {
        name: `${baseOf(file.name)}.xlsx`,
        blob: await rowsToXlsxBlob([
          { name: baseOf(file.name), rows: await parseCsv(await file.text()) },
        ]),
      },
    ]),
  },
  {
    id: "csv→xml",
    to: "XML",
    from: ["csv", "tsv"],
    category: "data",
    description: {
      fr: "Chaque ligne devient un élément <row>.",
      en: "Each row becomes a <row> element.",
    },
    run: each(async (file) => [
      {
        name: `${baseOf(file.name)}.xml`,
        blob: textBlob(
          rowsToXml(await parseCsv(await file.text()), "rows"),
          "application/xml",
        ),
      },
    ]),
  },
  {
    id: "csv→html",
    to: "HTML",
    from: ["csv", "tsv"],
    category: "data",
    description: {
      fr: "Un tableau HTML stylé et autonome.",
      en: "A standalone, styled HTML table.",
    },
    run: each(async (file) => [
      {
        name: `${baseOf(file.name)}.html`,
        blob: new Blob(
          [rowsToHtmlTable(await parseCsv(await file.text()), baseOf(file.name))],
          { type: "text/html;charset=utf-8" },
        ),
      },
    ]),
  },
  {
    id: "json→csv",
    to: "CSV",
    from: ["json"],
    category: "data",
    description: {
      fr: "Aplatit les objets imbriqués en colonnes `parent.enfant`.",
      en: "Flattens nested objects into `parent.child` columns.",
    },
    options: [DELIMITER_OPTION],
    run: each(async (file, ctx) => [
      {
        name: `${baseOf(file.name)}.csv`,
        blob: textBlob(
          await toCsv(
            tabularize(JSON.parse(await file.text())),
            String(ctx.options.delimiter ?? ","),
          ),
          "text/csv;charset=utf-8",
        ),
      },
    ]),
  },
  {
    id: "json→xlsx",
    to: "Excel (.xlsx)",
    from: ["json"],
    category: "data",
    description: {
      fr: "Le tableau JSON devient une feuille de calcul.",
      en: "The JSON array becomes a spreadsheet.",
    },
    run: each(async (file) => [
      {
        name: `${baseOf(file.name)}.xlsx`,
        blob: await rowsToXlsxBlob([
          {
            name: baseOf(file.name),
            rows: tabularize(JSON.parse(await file.text())),
          },
        ]),
      },
    ]),
  },
  {
    id: "json→xml",
    to: "XML",
    from: ["json"],
    category: "data",
    description: {
      fr: "Sérialise le JSON en arborescence XML.",
      en: "Serializes the JSON as an XML tree.",
    },
    run: each(async (file) => {
      const { XMLBuilder } = await import("fast-xml-parser");
      const builder = new XMLBuilder({
        format: true,
        ignoreAttributes: false,
        attributeNamePrefix: "@",
        arrayNodeName: "item",
        suppressEmptyNode: true,
      });
      const data = JSON.parse(await file.text());
      const xml = builder.build(Array.isArray(data) ? { root: { item: data } } : { root: data });
      return [
        {
          name: `${baseOf(file.name)}.xml`,
          blob: textBlob(`<?xml version="1.0" encoding="UTF-8"?>\n${xml}`, "application/xml"),
        },
      ];
    }),
  },
  {
    id: "json→html",
    to: "HTML",
    from: ["json"],
    category: "data",
    description: {
      fr: "Un tableau HTML à partir du JSON aplati.",
      en: "An HTML table built from the flattened JSON.",
    },
    run: each(async (file) => [
      {
        name: `${baseOf(file.name)}.html`,
        blob: new Blob(
          [
            rowsToHtmlTable(
              tabularize(JSON.parse(await file.text())),
              baseOf(file.name),
            ),
          ],
          { type: "text/html;charset=utf-8" },
        ),
      },
    ]),
  },
  {
    id: "xml→json",
    to: "JSON",
    from: ["xml", "rss", "atom", "svg"],
    category: "data",
    description: {
      fr: "Attributs préservés avec le préfixe @.",
      en: "Attributes kept with an @ prefix.",
    },
    run: each(async (file) => [
      {
        name: `${baseOf(file.name)}.json`,
        blob: textBlob(
          JSON.stringify(await parseXml(await file.text()), null, 2),
          "application/json",
        ),
      },
    ]),
  },
  {
    id: "xml→csv",
    to: "CSV",
    from: ["xml", "rss", "atom"],
    category: "data",
    description: {
      fr: "Repère la liste d'éléments répétés et l'aplatit en tableau.",
      en: "Finds the list of repeated elements and flattens it into a table.",
    },
    options: [DELIMITER_OPTION],
    run: each(async (file, ctx) => [
      {
        name: `${baseOf(file.name)}.csv`,
        blob: textBlob(
          await toCsv(
            tabularize(await parseXml(await file.text())),
            String(ctx.options.delimiter ?? ","),
          ),
          "text/csv;charset=utf-8",
        ),
      },
    ]),
  },
  {
    id: "xml→xlsx",
    to: "Excel (.xlsx)",
    from: ["xml", "rss", "atom"],
    category: "data",
    description: {
      fr: "La liste d'éléments répétés devient une feuille Excel.",
      en: "The list of repeated elements becomes an Excel sheet.",
    },
    run: each(async (file) => [
      {
        name: `${baseOf(file.name)}.xlsx`,
        blob: await rowsToXlsxBlob([
          {
            name: baseOf(file.name),
            rows: tabularize(await parseXml(await file.text())),
          },
        ]),
      },
    ]),
  },
];
