// Generates placeholder PWA icons from inline SVG using sharp.
// Run with: pnpm icons
//
// Per spec §9 we need:
//   - 192 (any), 512 (any) — primary launcher icons
//   - 512 (maskable)       — Android adaptive icon (safe zone = inner 80%)
//   - 512 (monochrome)     — Android 13+ themed icon (white on transparent)

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "public", "icons");

const BG = "#22252A";      // charcoal — spec dark surface
const FG = "#FFC83B";      // accent yellow

// "H" mark, centered. Generous letterform so it reads at 48px.
function letterMarkSvg({ size, bg, fg, padding = 0 }) {
  const inner = size - padding * 2;
  // Tuned to roughly fill the safe area without clipping descenders.
  const fontSize = Math.round(inner * 0.62);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${bg ? `<rect width="100%" height="100%" rx="${size * 0.22}" fill="${bg}"/>` : ""}
    <text x="50%" y="50%"
          text-anchor="middle"
          dominant-baseline="central"
          font-family="-apple-system, Segoe UI, Roboto, Inter, sans-serif"
          font-weight="700"
          font-size="${fontSize}"
          fill="${fg}">H</text>
  </svg>`;
}

async function render(svg, outPath, size) {
  const buf = await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toBuffer();
  await writeFile(outPath, buf);
  console.log(`  wrote ${path.relative(process.cwd(), outPath)} (${buf.length} bytes)`);
}

async function main() {
  await mkdir(OUT, { recursive: true });

  // Standard "any" icons — rounded square with H mark.
  await render(letterMarkSvg({ size: 192, bg: BG, fg: FG }),
               path.join(OUT, "icon-192.png"), 192);
  await render(letterMarkSvg({ size: 512, bg: BG, fg: FG }),
               path.join(OUT, "icon-512.png"), 512);

  // Maskable — Android crops up to outer 20%. Pad the mark inside a
  // full-bleed background so the safe zone (inner ~80%) contains the H.
  const maskableSvg = letterMarkSvg({
    size: 512,
    bg: BG,
    fg: FG,
    padding: 64, // 12.5% safe-zone inset
  });
  // Replace the rounded-rect background with full-bleed for maskable.
  const fullBleedMaskable = maskableSvg.replace(
    /<rect[^/]*\/>/,
    `<rect width="100%" height="100%" fill="${BG}"/>`,
  );
  await render(fullBleedMaskable, path.join(OUT, "icon-maskable-512.png"), 512);

  // Monochrome — white H on transparent background. Android themes it.
  const monoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <text x="50%" y="50%"
          text-anchor="middle"
          dominant-baseline="central"
          font-family="-apple-system, Segoe UI, Roboto, Inter, sans-serif"
          font-weight="700"
          font-size="320"
          fill="#FFFFFF">H</text>
  </svg>`;
  await render(monoSvg, path.join(OUT, "icon-monochrome-512.png"), 512);

  console.log("icons regenerated");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
