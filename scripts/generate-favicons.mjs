// Regenerate the raster favicons from app/icon.svg (the brand mark, the single
// source of truth). Run with:  node scripts/generate-favicons.mjs
//
// Produces:
//   app/favicon.ico   — multi-size (16/32/48) PNG-compressed ICO for browser tabs
//   app/apple-icon.png — 180×180 apple-touch-icon (corners flattened to brand green)
//
// Next.js auto-wires app/icon.svg, app/favicon.ico and app/apple-icon.png via its
// metadata-file conventions — no <link> tags needed.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BRAND_GREEN = "#376040";
const svg = await readFile(join(root, "app/icon.svg"));

// --- favicon.ico: pack several PNGs into one ICO container ---------------
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  const dir = Buffer.alloc(16 * images.length);
  let offset = 6 + 16 * images.length;
  images.forEach(({ size, buf }, i) => {
    const b = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, b + 0); // width  (0 = 256)
    dir.writeUInt8(size >= 256 ? 0 : size, b + 1); // height
    dir.writeUInt8(0, b + 2); // palette
    dir.writeUInt8(0, b + 3); // reserved
    dir.writeUInt16LE(1, b + 4); // color planes
    dir.writeUInt16LE(32, b + 6); // bits per pixel
    dir.writeUInt32LE(buf.length, b + 8);
    dir.writeUInt32LE(offset, b + 12);
    offset += buf.length;
  });

  return Buffer.concat([header, dir, ...images.map((i) => i.buf)]);
}

const icoSizes = [16, 32, 48];
const icoImages = await Promise.all(
  icoSizes.map(async (size) => ({
    size,
    buf: await sharp(svg).resize(size, size).png().toBuffer(),
  })),
);
await writeFile(join(root, "app/favicon.ico"), buildIco(icoImages));

// --- apple-icon.png: 180×180, opaque (iOS adds its own rounding) ----------
await sharp(svg)
  .resize(180, 180)
  .flatten({ background: BRAND_GREEN })
  .png()
  .toFile(join(root, "app/apple-icon.png"));

console.log("✓ wrote app/favicon.ico (16/32/48) and app/apple-icon.png (180)");
