import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const root = new URL("../", import.meta.url);
const svg = await readFile(new URL("src/domains/dashboard/assets/chagok-icon.svg", root));
const directory = new URL("build/icons/", root);
await mkdir(directory, { recursive: true });

const sizes = [16, 24, 32, 48, 64, 128, 256];
const images = sizes.map(size =>
  new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    font: { loadSystemFonts: false },
  })
    .render()
    .asPng(),
);

// ICO directory followed by one lossless PNG for each Windows DPI size.
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((size, index) => {
  const entry = 6 + index * 16;
  header[entry] = size === 256 ? 0 : size;
  header[entry + 1] = size === 256 ? 0 : size;
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(images[index].length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += images[index].length;
});
await writeFile(new URL("icon.ico", directory), Buffer.concat([header, ...images]));
await writeFile(
  new URL("icon.png", directory),
  new Resvg(svg, {
    fitTo: { mode: "width", value: 512 },
    font: { loadSystemFonts: false },
  })
    .render()
    .asPng(),
);
console.log(`Generated app icons from SVG: ${fileURLToPath(directory)}`);
