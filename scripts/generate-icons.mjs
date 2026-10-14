/**
 * Renders app/icon.svg into the bitmap icons the SVG alone does not cover:
 * - app/favicon.ico, for whatever only asks for /favicon.ico (older Safari,
 *   link previews, the Vercel dashboard);
 * - the PNGs a phone needs when the page is added to its home screen: iOS
 *   ignores SVG icons, and Android reads the manifest.
 *
 * Not part of the build — run `npm run icons` after changing the logo, then
 * commit the results.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

// sharp ships with Next.js for image optimisation.
const sharp = createRequire(import.meta.url)("sharp");

const root = process.cwd();
const PAPER = "#f4f2ec";

const source = await readFile(path.join(root, "app/icon.svg"), "utf8");
const viewBox = source.match(/viewBox="([^"]+)"/)[1];
const [, , width] = viewBox.split(/\s+/).map(Number);
const drawing = source.slice(source.indexOf(">") + 1, source.lastIndexOf("</svg>"));

/* Phones crop icons — rounded corners on iOS, sometimes a circle on Android —
   so the logo is shrunk onto a paper square, `margin` being the share of the
   side left empty on each edge. */
function onPaper(margin) {
  const scale = 1 - 2 * margin;
  const offset = (width * margin) / scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${width}">
  <rect width="${width}" height="${width}" fill="${PAPER}"/>
  <g transform="scale(${scale}) translate(${offset} ${offset})">${drawing}</g>
</svg>`;
}

function renderPng(size, margin = 0) {
  return sharp(Buffer.from(onPaper(margin)), { density: (72 * size) / width })
    .resize(size, size)
    .flatten({ background: PAPER })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/* An .ico is a directory of images; every browser since IE 9 accepts PNG
   entries, so no BMP encoding is needed. */
function toIco(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, entry); // width
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1); // height
    header.writeUInt8(0, entry + 2); // palette size
    header.writeUInt8(0, entry + 3); // reserved
    header.writeUInt16LE(1, entry + 4); // colour planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.data)]);
}

const outputs = [
  // iOS rounds the corners at about 22 % of the side.
  { file: "app/apple-icon.png", size: 180, margin: 0.1 },
  // Android may crop to a circle: the frame stays inside the 80 % safe zone.
  { file: "public/icons/maskable-512.png", size: 512, margin: 0.19 },
  { file: "public/icons/icon-192.png", size: 192, margin: 0 },
  { file: "public/icons/icon-512.png", size: 512, margin: 0 },
];

await mkdir(path.join(root, "public/icons"), { recursive: true });
for (const { file, size, margin } of outputs) {
  await writeFile(path.join(root, file), await renderPng(size, margin));
  console.log(`icône → ${file} (${size} px)`);
}

const icoSizes = [16, 32, 48];
const ico = toIco(
  await Promise.all(
    icoSizes.map(async (size) => ({ size, data: await renderPng(size) })),
  ),
);
await writeFile(path.join(root, "app/favicon.ico"), ico);
console.log(`icône → app/favicon.ico (${icoSizes.join(", ")} px)`);
