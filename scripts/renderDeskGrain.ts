// Draws the walnut desk's grain (plans/book-ui.md D20) into public/desk/walnut-grain.webp, a tile
// that `--desk-paint` in src/app/globals.css lays over the desk's colors. The grain is three SVG
// noise filters (the mockup plans/mockups/sign-in-cover.html draws them live); WebKit is slow to
// draw those filters, so the app shows them drawn once, as a picture. The tile's edges meet.
//
//   npx tsx scripts/renderDeskGrain.ts

import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const WIDTH = 1800;
const HEIGHT = 900;
const OUT = path.resolve(import.meta.dirname, "../public/desk/walnut-grain.webp");

// Long figure (d), broad light streaks (l) and fine fibers (f), each a noise stretched along the
// board and tinted, with its alpha from the noise: the desk's colors show through between them.
const GRAIN = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <filter id="d"><feTurbulence type="fractalNoise" baseFrequency="0.0016667 0.08" numOctaves="4" seed="3" stitchTiles="stitch"/>
    <feColorMatrix values="0 0 0 0 0.09  0 0 0 0 0.05  0 0 0 0 0.02  1.9 0 0 0 -0.86"/></filter>
  <filter id="l"><feTurbulence type="fractalNoise" baseFrequency="0.0011111 0.04" numOctaves="3" seed="11" stitchTiles="stitch"/>
    <feColorMatrix values="0 0 0 0 0.86  0 0 0 0 0.62  0 0 0 0 0.4  2.2 0 0 0 -1.12"/></filter>
  <filter id="f"><feTurbulence type="fractalNoise" baseFrequency="0.0055556 0.9" numOctaves="2" seed="5" stitchTiles="stitch"/>
    <feColorMatrix values="0 0 0 0 0.07  0 0 0 0 0.04  0 0 0 0 0.02  1.3 0 0 0 -0.6"/></filter>
  <rect width="${WIDTH}" height="${HEIGHT}" filter="url(#l)" opacity="0.28"/>
  <rect width="${WIDTH}" height="${HEIGHT}" filter="url(#d)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" filter="url(#f)" opacity="0.8"/>
</svg>`;

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  await page.setContent(`<body style="margin:0;background:transparent">${GRAIN}</body>`);
  const png = await page.locator("svg").screenshot({ omitBackground: true });
  await browser.close();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await sharp(png).webp({ quality: 55, alphaQuality: 65, effort: 6 }).toFile(OUT);
  console.log(`${path.relative(process.cwd(), OUT)}: ${Math.round(fs.statSync(OUT).size / 1024)} KB`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
