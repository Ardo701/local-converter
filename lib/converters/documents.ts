import type { Converter, OutFile } from "../types";
import {
  baseOf,
  canvasToBlob,
  escapeHtml,
  pad,
  textBlob,
  wrapHtmlDocument,
} from "../utils";

/* ------------------------------------------------------------------ *
 *  Shared helpers
 * ------------------------------------------------------------------ */

async function docxToHtml(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.convertToHtml({
    arrayBuffer: await file.arrayBuffer(),
  });
  return result.value;
}

async function htmlToMarkdown(html: string): Promise<string> {
  const TurndownService = (await import("turndown")).default;
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });
  return turndown.turndown(html);
}

async function markdownToHtml(md: string): Promise<string> {
  const { marked } = await import("marked");
  return await marked.parse(md, { async: true, gfm: true, breaks: false });
}

function htmlToPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style").forEach((el) => el.remove());
  doc
    .querySelectorAll("br")
    .forEach((el) => el.replaceWith(doc.createTextNode("\n")));
  doc
    .querySelectorAll("p, div, li, tr, h1, h2, h3, h4, h5, h6, blockquote, pre")
    .forEach((el) => el.append(doc.createTextNode("\n")));
  return (doc.body.textContent ?? "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

const PAGE_SIZES: Record<string, { width: number; height: number }> = {
  // millimetres
  a4: { width: 210, height: 297 },
  letter: { width: 215.9, height: 279.4 },
};

const PAGE_OPTION = {
  id: "page",
  label: "Format de page",
  type: "select" as const,
  default: "a4",
  choices: [
    { value: "a4", label: "A4" },
    { value: "letter", label: "Letter" },
  ],
};

/** Renders an HTML string offscreen and returns the resulting canvas. */
async function renderHtmlToCanvas(
  html: string,
  cssWidth: number,
  scale = 2,
): Promise<HTMLCanvasElement> {
  const html2canvas = (await import("html2canvas")).default;
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${cssWidth}px;background:#ffffff;z-index:-1;`;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const style = doc.querySelector("style")?.textContent ?? "";
  host.innerHTML = `<style>${style}</style><div class="doc-root" style="padding:0">${doc.body.innerHTML}</div>`;
  document.body.appendChild(host);
  try {
    // Give the browser a frame to lay out images and fonts.
    await new Promise((r) => setTimeout(r, 60));
    return await html2canvas(host, {
      scale,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      windowWidth: cssWidth,
    });
  } finally {
    host.remove();
  }
}

/** Slices a tall canvas into printable pages of the requested paper size. */
async function canvasToPdfBlob(
  canvas: HTMLCanvasElement,
  pageKey: string,
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const page = PAGE_SIZES[pageKey] ?? PAGE_SIZES.a4;
  const margin = 12;
  const contentWidth = page.width - margin * 2;
  const contentHeight = page.height - margin * 2;
  const pdf = new jsPDF({ unit: "mm", format: [page.width, page.height] });

  const pxPerMm = canvas.width / contentWidth;
  const sliceHeightPx = Math.floor(contentHeight * pxPerMm);
  const pages = Math.max(1, Math.ceil(canvas.height / sliceHeightPx));

  for (let i = 0; i < pages; i++) {
    const sliceCanvas = document.createElement("canvas");
    const height = Math.min(sliceHeightPx, canvas.height - i * sliceHeightPx);
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = height;
    const sctx = sliceCanvas.getContext("2d")!;
    sctx.fillStyle = "#ffffff";
    sctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    sctx.drawImage(canvas, 0, -i * sliceHeightPx);
    if (i > 0) pdf.addPage([page.width, page.height]);
    pdf.addImage(
      sliceCanvas.toDataURL("image/jpeg", 0.92),
      "JPEG",
      margin,
      margin,
      contentWidth,
      height / pxPerMm,
    );
  }
  return pdf.output("blob");
}

async function htmlToPdfBlob(html: string, pageKey: string): Promise<Blob> {
  const canvas = await renderHtmlToCanvas(html, 794);
  return canvasToPdfBlob(canvas, pageKey);
}

/**
 * Wraps an HTML fragment in a minimal .docx using an "altChunk" part: Word
 * imports the HTML and renders it as a fully editable document.
 */
async function htmlToDocxBlob(html: string, title: string): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="html" ContentType="text/html"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="htmlChunk" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/aFChunk" Target="afchunk.html"/>
</Relationships>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
<w:altChunk xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="htmlChunk"/>
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>
</w:body>
</w:document>`,
  );
  zip.file("word/afchunk.html", wrapHtmlDocument(title, html));
  return zip.generateAsync({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

async function loadPdf(file: File) {
  const pdfjs = await import("pdfjs-dist");
  // Staged in public/pdfjs by scripts/prepare-assets.mjs.
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  });
  const pdf = await task.promise;
  return { pdf, close: () => task.destroy() };
}

/* ------------------------------------------------------------------ *
 *  RTF — a compact reader good enough for text and basic styling
 * ------------------------------------------------------------------ */

type RtfSpan = { text: string; bold: boolean; italic: boolean; newParagraph: boolean };

function parseRtf(rtf: string): RtfSpan[] {
  const spans: RtfSpan[] = [];
  const stack: { bold: boolean; italic: boolean; skip: boolean }[] = [];
  let state = { bold: false, italic: false, skip: false };
  let buffer = "";
  let pendingParagraph = false;
  // \ucN says how many characters follow a \uN escape as an ANSI fallback.
  let unicodeSkipWidth = 1;
  let skipChars = 0;

  const flush = () => {
    if (!buffer) return;
    spans.push({
      text: buffer,
      bold: state.bold,
      italic: state.italic,
      newParagraph: pendingParagraph,
    });
    buffer = "";
    pendingParagraph = false;
  };

  for (let i = 0; i < rtf.length; i++) {
    const ch = rtf[i];
    if (ch === "\\") {
      const next = rtf[i + 1];
      if (next === "\\" || next === "{" || next === "}") {
        if (!state.skip) buffer += next;
        i++;
        continue;
      }
      if (next === "'") {
        const hex = rtf.slice(i + 2, i + 4);
        if (skipChars > 0) skipChars--;
        else if (!state.skip)
          buffer += String.fromCharCode(parseInt(hex, 16));
        i += 3;
        continue;
      }
      const match = /^\\([a-zA-Z]+)(-?\d+)? ?/.exec(rtf.slice(i));
      if (!match) continue;
      const word = match[1];
      const value = match[2] === undefined ? null : parseInt(match[2], 10);
      i += match[0].length - 1;
      switch (word) {
        case "par":
        case "line":
          flush();
          pendingParagraph = true;
          break;
        case "tab":
          if (!state.skip) buffer += "\t";
          break;
        case "b":
          flush();
          state = { ...state, bold: value !== 0 };
          break;
        case "i":
          flush();
          state = { ...state, italic: value !== 0 };
          break;
        case "plain":
          flush();
          state = { ...state, bold: false, italic: false };
          break;
        case "uc":
          unicodeSkipWidth = value ?? 1;
          break;
        case "u":
          if (value !== null && !state.skip)
            buffer += String.fromCharCode(value < 0 ? value + 65536 : value);
          skipChars = unicodeSkipWidth;
          break;
        case "fonttbl":
        case "colortbl":
        case "stylesheet":
        case "info":
        case "pict":
        case "themedata":
        case "colorschememapping":
        case "latentstyles":
        case "datastore":
          state = { ...state, skip: true };
          break;
        default:
          break;
      }
      continue;
    }
    if (ch === "{") {
      flush();
      stack.push({ ...state });
      continue;
    }
    if (ch === "}") {
      flush();
      const restored = stack.pop();
      if (restored) state = restored;
      continue;
    }
    if (ch === "\r" || ch === "\n") continue;
    if (skipChars > 0) {
      skipChars--;
      continue;
    }
    if (!state.skip) buffer += ch;
  }
  flush();
  return spans;
}

function rtfToHtml(rtf: string): string {
  const spans = parseRtf(rtf);
  const paragraphs: string[] = [];
  let current = "";
  for (const span of spans) {
    if (span.newParagraph && current) {
      paragraphs.push(current);
      current = "";
    }
    let piece = escapeHtml(span.text);
    if (!piece.trim() && !piece.length) continue;
    if (span.bold) piece = `<strong>${piece}</strong>`;
    if (span.italic) piece = `<em>${piece}</em>`;
    current += piece;
  }
  if (current) paragraphs.push(current);
  return paragraphs
    .map((p) => `<p>${p}</p>`)
    .join("\n")
    .replace(/<p>\s*<\/p>/g, "");
}

/* ------------------------------------------------------------------ *
 *  Converters
 * ------------------------------------------------------------------ */

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

export const documentConverters: Converter[] = [
  {
    id: "docx→html",
    to: "HTML",
    from: ["docx"],
    category: "documents",
    description: "Extrait la structure du document Word en HTML propre.",
    run: each(async (file) => [
      {
        name: `${baseOf(file.name)}.html`,
        blob: new Blob(
          [wrapHtmlDocument(baseOf(file.name), await docxToHtml(file))],
          { type: "text/html;charset=utf-8" },
        ),
      },
    ]),
  },
  {
    id: "docx→md",
    to: "Markdown",
    from: ["docx"],
    category: "documents",
    description: "Word vers Markdown, en passant par le HTML intermédiaire.",
    run: each(async (file) => [
      {
        name: `${baseOf(file.name)}.md`,
        blob: textBlob(await htmlToMarkdown(await docxToHtml(file)), "text/markdown"),
      },
    ]),
  },
  {
    id: "docx→txt",
    to: "Texte brut",
    from: ["docx"],
    category: "documents",
    description: "Ne conserve que le texte du document Word.",
    run: each(async (file) => [
      {
        name: `${baseOf(file.name)}.txt`,
        blob: textBlob(htmlToPlainText(await docxToHtml(file))),
      },
    ]),
  },
  {
    id: "docx→pdf",
    to: "PDF",
    from: ["docx"],
    category: "documents",
    description: "Rend le document Word puis l'imprime en PDF paginé.",
    options: [PAGE_OPTION],
    run: each(async (file, ctx) => [
      {
        name: `${baseOf(file.name)}.pdf`,
        blob: await htmlToPdfBlob(
          wrapHtmlDocument(baseOf(file.name), await docxToHtml(file)),
          String(ctx.options.page ?? "a4"),
        ),
      },
    ]),
  },
  {
    id: "md→html",
    to: "HTML",
    from: ["md", "markdown", "mdown"],
    category: "documents",
    description: "Markdown (GFM) vers une page HTML autonome et stylée.",
    run: each(async (file) => [
      {
        name: `${baseOf(file.name)}.html`,
        blob: new Blob(
          [
            wrapHtmlDocument(
              baseOf(file.name),
              await markdownToHtml(await file.text()),
            ),
          ],
          { type: "text/html;charset=utf-8" },
        ),
      },
    ]),
  },
  {
    id: "md→pdf",
    to: "PDF",
    from: ["md", "markdown", "mdown"],
    category: "documents",
    description: "Markdown rendu en HTML puis imprimé en PDF.",
    options: [PAGE_OPTION],
    run: each(async (file, ctx) => [
      {
        name: `${baseOf(file.name)}.pdf`,
        blob: await htmlToPdfBlob(
          wrapHtmlDocument(
            baseOf(file.name),
            await markdownToHtml(await file.text()),
          ),
          String(ctx.options.page ?? "a4"),
        ),
      },
    ]),
  },
  {
    id: "md→docx",
    to: "Word (.docx)",
    from: ["md", "markdown", "mdown"],
    category: "documents",
    description: "Markdown vers un document Word éditable.",
    run: each(async (file) => [
      {
        name: `${baseOf(file.name)}.docx`,
        blob: await htmlToDocxBlob(
          await markdownToHtml(await file.text()),
          baseOf(file.name),
        ),
      },
    ]),
  },
  {
    id: "md→txt",
    to: "Texte brut",
    from: ["md", "markdown", "mdown"],
    category: "documents",
    description: "Retire toute la syntaxe Markdown.",
    run: each(async (file) => [
      {
        name: `${baseOf(file.name)}.txt`,
        blob: textBlob(htmlToPlainText(await markdownToHtml(await file.text()))),
      },
    ]),
  },
  {
    id: "html→pdf",
    to: "PDF",
    from: ["html", "htm"],
    category: "documents",
    description: "Rend la page dans un cadre invisible puis la pagine en PDF.",
    options: [PAGE_OPTION],
    run: each(async (file, ctx) => [
      {
        name: `${baseOf(file.name)}.pdf`,
        blob: await htmlToPdfBlob(
          await file.text(),
          String(ctx.options.page ?? "a4"),
        ),
      },
    ]),
  },
  {
    id: "html→docx",
    to: "Word (.docx)",
    from: ["html", "htm"],
    category: "documents",
    description: "Emballe le HTML dans un .docx ouvrable et éditable dans Word.",
    run: each(async (file) => [
      {
        name: `${baseOf(file.name)}.docx`,
        blob: await htmlToDocxBlob(await file.text(), baseOf(file.name)),
      },
    ]),
  },
  {
    id: "html→md",
    to: "Markdown",
    from: ["html", "htm"],
    category: "documents",
    description: "Reconstruit du Markdown à partir de la structure HTML.",
    run: each(async (file) => [
      {
        name: `${baseOf(file.name)}.md`,
        blob: textBlob(await htmlToMarkdown(await file.text()), "text/markdown"),
      },
    ]),
  },
  {
    id: "html→txt",
    to: "Texte brut",
    from: ["html", "htm"],
    category: "documents",
    description: "Ne garde que le texte visible de la page.",
    run: each(async (file) => [
      {
        name: `${baseOf(file.name)}.txt`,
        blob: textBlob(htmlToPlainText(await file.text())),
      },
    ]),
  },
  {
    id: "html→image",
    to: "Image (PNG/JPG)",
    from: ["html", "htm"],
    category: "documents",
    description: "Capture le rendu complet de la page dans une image.",
    options: [
      {
        id: "format",
        label: "Format",
        type: "select",
        default: "png",
        choices: [
          { value: "png", label: "PNG" },
          { value: "jpg", label: "JPG" },
        ],
      },
      {
        id: "width",
        label: "Largeur de rendu",
        type: "number",
        default: 1280,
        min: 320,
        max: 2560,
        step: 10,
        suffix: "px",
      },
    ],
    run: each(async (file, ctx) => {
      const format = String(ctx.options.format ?? "png");
      const canvas = await renderHtmlToCanvas(
        await file.text(),
        Number(ctx.options.width ?? 1280),
      );
      return [
        {
          name: `${baseOf(file.name)}.${format}`,
          blob: await canvasToBlob(
            canvas,
            format === "jpg" ? "image/jpeg" : "image/png",
            0.92,
          ),
        },
      ];
    }),
  },
  {
    id: "pdf→image",
    to: "Images (page par page)",
    from: ["pdf"],
    category: "documents",
    description: "Rend chaque page du PDF dans une image indépendante.",
    multiOutput: true,
    options: [
      {
        id: "format",
        label: "Format",
        type: "select",
        default: "png",
        choices: [
          { value: "png", label: "PNG" },
          { value: "jpg", label: "JPG" },
        ],
      },
      {
        id: "scale",
        label: "Résolution",
        type: "select",
        default: "2",
        choices: [
          { value: "1", label: "96 dpi (écran)" },
          { value: "2", label: "192 dpi (recommandé)" },
          { value: "3", label: "288 dpi (impression)" },
        ],
      },
    ],
    run: each(async (file, ctx) => {
      const format = String(ctx.options.format ?? "png");
      const scale = Number(ctx.options.scale ?? 2);
      const { pdf, close } = await loadPdf(file);
      const out: OutFile[] = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        ctx.onProgress((p - 1) / pdf.numPages, `page ${p}/${pdf.numPages}`);
        const page = await pdf.getPage(p);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d")!;
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport }).promise;
        out.push({
          name: `${baseOf(file.name)}-${pad(p)}.${format}`,
          blob: await canvasToBlob(
            canvas,
            format === "jpg" ? "image/jpeg" : "image/png",
            0.92,
          ),
        });
      }
      await close();
      return out;
    }),
  },
  {
    id: "pdf→txt",
    to: "Texte brut",
    from: ["pdf"],
    category: "documents",
    description:
      "Extrait la couche texte du PDF (sans OCR : un PDF scanné ne donnera rien).",
    run: each(async (file, ctx) => {
      const { pdf, close } = await loadPdf(file);
      const chunks: string[] = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        ctx.onProgress((p - 1) / pdf.numPages, `page ${p}/${pdf.numPages}`);
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        let line = "";
        const lines: string[] = [];
        let lastY: number | null = null;
        for (const item of content.items) {
          if (!("str" in item)) continue;
          const y = item.transform[5] as number;
          if (lastY !== null && Math.abs(y - lastY) > 2) {
            lines.push(line.trimEnd());
            line = "";
          }
          line += item.str + (item.hasEOL ? "\n" : "");
          lastY = y;
        }
        if (line) lines.push(line.trimEnd());
        chunks.push(lines.join("\n").replace(/\n{3,}/g, "\n\n"));
      }
      await close();
      const text = chunks.join("\n\n---\n\n").trim();
      if (!text) {
        throw new Error(
          "Ce PDF ne contient aucune couche texte (document scanné ou entièrement graphique). Convertissez-le en images à la place.",
        );
      }
      return [
        { name: `${baseOf(file.name)}.txt`, blob: textBlob(text) },
      ];
    }),
  },
  {
    id: "rtf→html",
    to: "HTML",
    from: ["rtf"],
    category: "documents",
    description: "Lit le texte enrichi et restitue gras, italique et paragraphes.",
    run: each(async (file) => [
      {
        name: `${baseOf(file.name)}.html`,
        blob: new Blob(
          [wrapHtmlDocument(baseOf(file.name), rtfToHtml(await file.text()))],
          { type: "text/html;charset=utf-8" },
        ),
      },
    ]),
  },
  {
    id: "rtf→txt",
    to: "Texte brut",
    from: ["rtf"],
    category: "documents",
    description: "Retire tout le balisage RTF.",
    run: each(async (file) => [
      {
        name: `${baseOf(file.name)}.txt`,
        blob: textBlob(htmlToPlainText(rtfToHtml(await file.text()))),
      },
    ]),
  },
  {
    id: "rtf→md",
    to: "Markdown",
    from: ["rtf"],
    category: "documents",
    description: "Texte enrichi vers Markdown.",
    run: each(async (file) => [
      {
        name: `${baseOf(file.name)}.md`,
        blob: textBlob(
          await htmlToMarkdown(rtfToHtml(await file.text())),
          "text/markdown",
        ),
      },
    ]),
  },
  {
    id: "txt→pdf",
    to: "PDF",
    from: ["txt", "log"],
    category: "documents",
    description: "Met en page le texte brut dans un PDF lisible.",
    options: [PAGE_OPTION],
    run: each(async (file, ctx) => [
      {
        name: `${baseOf(file.name)}.pdf`,
        blob: await htmlToPdfBlob(
          wrapHtmlDocument(
            baseOf(file.name),
            `<pre style="white-space:pre-wrap;background:none;padding:0">${escapeHtml(
              await file.text(),
            )}</pre>`,
          ),
          String(ctx.options.page ?? "a4"),
        ),
      },
    ]),
  },
];
