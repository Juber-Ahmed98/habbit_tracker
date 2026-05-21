// Generates PWA icons from app/icon.svg using sharp.
// Run with: pnpm icons
//
// Per spec §9 we need:
//   - 192 (any), 512 (any) — primary launcher icons
//   - 512 (maskable)       — Android adaptive icon (safe zone = inner 80%)
//   - 512 (monochrome)     — Android 13+ themed icon (white on transparent)
//
// The "any" PNGs preserve the source SVG's rounded corners (transparent
// outside the rounded rect). The maskable PNG strips the corner radius and
// shrinks the artwork into the safe zone, so Android's adaptive-icon mask can
// crop without clipping anything important. The monochrome glyph is a small
// custom SVG since the source is full-colour with gradients.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "public", "icons");
const SOURCE = path.join(__dirname, "..", "app", "icon.svg");

const BG = "#22252A"; // charcoal — matches the source SVG background stop

async function renderSvgToPng(svg, outPath, size) {
  const buf = await sharp(Buffer.from(svg), { density: 384 })
    .resize(size, size)
    .png()
    .toBuffer();
  await writeFile(outPath, buf);
  console.log(
    `  wrote ${path.relative(process.cwd(), outPath)} (${buf.length} bytes)`,
  );
}

// Maskable variant: replace the rounded-rect background with full-bleed (rx=0)
// and scale the rest of the artwork into the inner safe zone (~80%). Android
// crops up to the outer 20% so anything outside the safe zone can vanish.
function buildMaskableSvg(sourceSvg) {
  const fullBleed = sourceSvg.replace(
    /<rect width="512" height="512" rx="112"[^/]*\/>/,
    `<rect width="512" height="512" fill="${BG}"/>`,
  );
  // Wrap everything after the background <rect> in a translated/scaled <g>
  // so the artwork sits in the inner 80% safe zone (52..460).
  return fullBleed.replace(
    /(<rect width="512" height="512" fill="[^"]+"\/>)/,
    `$1\n  <g transform="translate(51.2 51.2) scale(0.8)">`,
  ).replace(/<\/svg>\s*$/, `  </g>\n</svg>`);
}

// Monochrome variant: simple white silhouette on transparent. Mirrors the core
// motif from the source — outer progress ring + dashed mid ring + filled
// centre disc with a checkmark. Android themes this to the user's wallpaper.
const MONOCHROME_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <circle cx="256" cy="256" r="120" fill="none" stroke="#FFFFFF" stroke-width="16" />
  <circle cx="256" cy="256" r="76" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-dasharray="6 6" />
  <circle cx="256" cy="256" r="60" fill="#FFFFFF" />
  <path d="M226 256 L246 276 L286 230"
        fill="none"
        stroke="#000000"
        stroke-width="12"
        stroke-linecap="round"
        stroke-linejoin="round" />
</svg>`;

async function main() {
  await mkdir(OUT, { recursive: true });
  const source = await readFile(SOURCE, "utf8");

  // Standard "any" icons — render the source SVG directly. Transparent
  // outside the rounded-rect background.
  await renderSvgToPng(source, path.join(OUT, "icon-192.png"), 192);
  await renderSvgToPng(source, path.join(OUT, "icon-512.png"), 512);

  // Maskable — full bleed, artwork in safe zone.
  const maskable = buildMaskableSvg(source);
  await renderSvgToPng(maskable, path.join(OUT, "icon-maskable-512.png"), 512);

  // Monochrome — themed icon for Android 13+.
  await renderSvgToPng(
    MONOCHROME_SVG,
    path.join(OUT, "icon-monochrome-512.png"),
    512,
  );

  console.log("icons regenerated");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
