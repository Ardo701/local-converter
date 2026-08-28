import type { Converter, OutFile } from "../types";
import { baseOf, textBlob } from "../utils";

function each(
  handler: (
    file: File,
    ctx: Parameters<Converter["run"]>[1],
  ) => Promise<OutFile[]>,
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

const STYLE_OPTION = {
  id: "style",
  label: "Sortie",
  type: "select" as const,
  default: "expanded",
  choices: [
    { value: "expanded", label: "Lisible (expanded)" },
    { value: "compressed", label: "Minifiée (compressed)" },
  ],
};

const TARGET_OPTION = {
  id: "target",
  label: "Cible JavaScript",
  type: "select" as const,
  default: "ES2020",
  choices: [
    { value: "ESNext", label: "ESNext" },
    { value: "ES2020", label: "ES2020 — recommandé" },
    { value: "ES2017", label: "ES2017" },
    { value: "ES5", label: "ES5 (navigateurs anciens)" },
  ],
};

async function transpile(
  source: string,
  fileName: string,
  target: string,
  jsx: boolean,
): Promise<string> {
  const ts = await import("typescript");
  const result = ts.transpileModule(source, {
    fileName,
    compilerOptions: {
      target: ts.ScriptTarget[target as keyof typeof ts.ScriptTarget] as number,
      module: ts.ModuleKind.ESNext,
      jsx: jsx ? ts.JsxEmit.ReactJSX : ts.JsxEmit.None,
      removeComments: false,
      isolatedModules: true,
    },
  });
  return result.outputText;
}

export const codeConverters: Converter[] = [
  {
    id: "scss→css",
    to: "CSS",
    from: ["scss", "sass"],
    category: "code",
    description: "Compilation Dart Sass complète, exécutée dans le navigateur.",
    options: [STYLE_OPTION],
    run: each(async (file, ctx) => {
      const sass = await import("sass");
      const isIndented = file.name.toLowerCase().endsWith(".sass");
      const result = sass.compileString(await file.text(), {
        syntax: isIndented ? "indented" : "scss",
        style: String(ctx.options.style ?? "expanded") as
          | "expanded"
          | "compressed",
      });
      return [
        { name: `${baseOf(file.name)}.css`, blob: textBlob(result.css, "text/css") },
      ];
    }),
  },
  {
    id: "less→css",
    to: "CSS",
    from: ["less"],
    category: "code",
    description: "Compilateur Less officiel, en local.",
    options: [
      {
        id: "compress",
        label: "Minifier la sortie",
        type: "boolean",
        default: false,
      },
    ],
    run: each(async (file, ctx) => {
      const less = (await import("less")).default;
      const result = await less.render(await file.text(), {
        compress: Boolean(ctx.options.compress),
        filename: file.name,
      });
      return [
        { name: `${baseOf(file.name)}.css`, blob: textBlob(result.css, "text/css") },
      ];
    }),
  },
  {
    id: "ts→js",
    to: "JavaScript",
    from: ["ts", "mts", "cts"],
    category: "code",
    description: "Retire les types via le compilateur TypeScript officiel.",
    options: [TARGET_OPTION],
    run: each(async (file, ctx) => [
      {
        name: `${baseOf(file.name)}.js`,
        blob: textBlob(
          await transpile(
            await file.text(),
            file.name,
            String(ctx.options.target ?? "ES2020"),
            false,
          ),
          "text/javascript",
        ),
      },
    ]),
  },
  {
    id: "tsx→js",
    to: "JavaScript",
    from: ["tsx", "jsx"],
    category: "code",
    description:
      "Transpile le JSX/TSX vers du JavaScript avec la nouvelle transformation React.",
    options: [TARGET_OPTION],
    run: each(async (file, ctx) => [
      {
        name: `${baseOf(file.name)}.js`,
        blob: textBlob(
          await transpile(
            await file.text(),
            file.name,
            String(ctx.options.target ?? "ES2020"),
            true,
          ),
          "text/javascript",
        ),
      },
    ]),
  },
];
