import type { Converter, OutFile } from "../types";
import { baseOf, textBlob } from "../utils";

async function loadObjScene(text: string) {
  const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js");
  return new OBJLoader().parse(text);
}

async function loadStlScene(buffer: ArrayBuffer) {
  const THREE = await import("three");
  const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");
  const geometry = new STLLoader().parse(buffer);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: 0xcccccc }),
  );
  const group = new THREE.Group();
  group.add(mesh);
  return group;
}

async function exportGltf(
  object: import("three").Object3D,
  binary: boolean,
): Promise<Blob> {
  const { GLTFExporter } = await import(
    "three/examples/jsm/exporters/GLTFExporter.js"
  );
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(object, { binary });
  if (binary) {
    return new Blob([result as ArrayBuffer], { type: "model/gltf-binary" });
  }
  return textBlob(JSON.stringify(result, null, 2), "model/gltf+json");
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

async function sceneOf(file: File) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".obj")) return loadObjScene(await file.text());
  if (name.endsWith(".stl")) return loadStlScene(await file.arrayBuffer());
  throw new Error("Format 3D non supporté.");
}

export const threeConverters: Converter[] = [
  {
    id: "3d→glb",
    to: "GLB (glTF binaire)",
    from: ["obj", "stl"],
    category: "3d",
    description: "Le format 3D du web : géométrie et matériaux dans un seul fichier.",
    run: each(async (file) => [
      {
        name: `${baseOf(file.name)}.glb`,
        blob: await exportGltf(await sceneOf(file), true),
      },
    ]),
  },
  {
    id: "3d→gltf",
    to: "glTF (JSON)",
    from: ["obj", "stl"],
    category: "3d",
    description: "Version JSON lisible du glTF, pratique pour l'inspection.",
    run: each(async (file) => [
      {
        name: `${baseOf(file.name)}.gltf`,
        blob: await exportGltf(await sceneOf(file), false),
      },
    ]),
  },
  {
    id: "gltf→glb",
    to: "GLB (glTF binaire)",
    from: ["gltf"],
    category: "3d",
    description: "Compacte un glTF JSON (et ses buffers embarqués) en un seul GLB.",
    run: each(async (file) => {
      const { GLTFLoader } = await import(
        "three/examples/jsm/loaders/GLTFLoader.js"
      );
      const loader = new GLTFLoader();
      const gltf = await loader.parseAsync(await file.text(), "");
      return [
        {
          name: `${baseOf(file.name)}.glb`,
          blob: await exportGltf(gltf.scene, true),
        },
      ];
    }),
  },
];
