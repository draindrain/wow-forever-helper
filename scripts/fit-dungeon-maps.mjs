// Fits Classic world coordinates onto Wowhead's dungeon map images, so bosses can be
// pinned on them. Run after `data:fetch` (needs data-raw/cmangos and wago); writes
// scripts/dungeon-maps.json, which build-data reads. Rarely needed: only when Wowhead
// changes its map images.
//
// Wowhead's images aren't the game's map textures, so there are no bounds to read.
// Instead each map gets the scale and offset that put the most creature spawns on
// drawn (non-black) pixels while covering as much of the drawn area as possible.
// Check every fit by eye in the previews (data-raw/maps/check-<map>.png) before
// listing the map in PINNED_MAPS (scripts/curated.mjs).
//
// Usage: node scripts/fit-dungeon-maps.mjs [--only=43,389]

import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DUNGEONS, INSTANCE_ZONES, BOSS_SPAWNS } from './curated.mjs';
import { parseCsv } from './lib/csv.mjs';
import { bossPins, MAP_W, MAP_H, toMap } from './lib/boss-pins.mjs';
import { encounterBosses } from './lib/encounters.mjs';
import { findChromium } from './lib/chromium.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = path.join(root, 'data-raw');
const outFile = path.join(root, 'scripts', 'dungeon-maps.json');
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const only = onlyArg ? new Set(onlyArg.slice(7).split(',').map(Number)) : null;
const exists = (f) =>
  access(f).then(
    () => true,
    () => false,
  );

const data = JSON.parse(await readFile(path.join(rawDir, 'cmangos', 'dungeon-spawns.json'), 'utf8'));
const encounters = parseCsv(await readFile(path.join(rawDir, 'wago', 'DungeonEncounter.csv'), 'utf8'));
const fits = (await exists(outFile)) ? JSON.parse(await readFile(outFile, 'utf8')) : {};

// One image per game map (multi-wing instances share theirs).
const targets = new Map();
for (const d of DUNGEONS) {
  const zone = INSTANCE_ZONES[d.id]?.[0];
  if (d.map && zone && !d.isNew && data.spawns.some((s) => s.map === d.map)) targets.set(d.map, zone);
}

const { chromium } = await import('playwright-core');
const browser = await chromium.launch({ executablePath: findChromium() });
const page = await browser.newPage({ viewport: { width: MAP_W, height: MAP_H } });
await mkdir(path.join(rawDir, 'maps'), { recursive: true });

for (const [mapId, zone] of targets) {
  if (only && !only.has(mapId)) continue;
  const res = await fetch(`https://wow.zamimg.com/images/wow/classicplus/maps/enus/zoom/${zone}.jpg`);
  if (!res.ok) {
    console.log(`map ${mapId} (zone ${zone}): no image on Wowhead, skipped`);
    continue;
  }
  const img = `data:image/jpeg;base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
  const pts = data.spawns.filter((s) => s.map === mapId).map((s) => [s.x, s.y]);
  await page.setContent(`<canvas id="c" width="${MAP_W}" height="${MAP_H}"></canvas>`);
  const best = await page.evaluate(fitMap, { img, pts, W: MAP_W, H: MAP_H });
  const fit = { zone, k: best.k, cx: best.cx, cy: best.cy, crop: best.crop, precision: best.P, recall: best.R };
  fits[mapId] = fit;
  console.log(`map ${mapId} (zone ${zone}): ${pts.length} spawns, ${Math.round(best.P * 100)}% on drawn map, ${Math.round(best.R * 100)}% of it covered`);

  // Preview: spawns as dots, bosses as numbered pins.
  const pins = bossPins(encounterBosses(encounters, mapId), data, mapId, fit, BOSS_SPAWNS);
  const dots = data.spawns
    .filter((s) => s.map === mapId)
    .map((s) => toMap(fit, s.x, s.y))
    .map(([x, y]) => `<i style="left:${x}%;top:${y}%"></i>`)
    .join('');
  const marks = pins
    .flatMap((b, i) => b.pins.map(([x, y]) => `<b style="left:${x}%;top:${y}%">${i + 1}</b>`))
    .join('');
  await page.setContent(
    `<style>body{margin:0}div{position:relative;width:${MAP_W}px;height:${MAP_H}px}img{display:block}i,b{position:absolute;transform:translate(-50%,-50%)}i{width:3px;height:3px;background:#0f0}b{font:bold 11px sans-serif;color:#fff;background:#c00;border:1px solid #fff;border-radius:50%;min-width:15px;line-height:15px;text-align:center}</style><div><img src="${img}">${dots}${marks}</div>`,
  );
  await page.screenshot({ path: path.join(rawDir, 'maps', `check-${mapId}.png`) });
}
await browser.close();
await writeFile(outFile, JSON.stringify(fits, null, 2) + '\n');
console.log(`wrote ${path.relative(root, outFile)}`);

/**
 * Runs in the page: grid search over scale and offset (three passes, each finer around
 * the last best), scoring precision (spawns on drawn pixels) against recall (drawn
 * cells with a spawn nearby), so squeezing every spawn into one room doesn't win.
 */
async function fitMap({ img, pts, W, H }) {
  const im = new Image();
  im.src = img;
  await im.decode();
  const g = document.getElementById('c').getContext('2d');
  g.drawImage(im, 0, 0, W, H);
  const px = g.getImageData(0, 0, W, H).data;
  const C = 6;
  const GW = Math.ceil(W / C);
  const GH = Math.ceil(H / C);
  const mask = new Uint8Array(GW * GH);
  for (let gy = 0; gy < GH; gy++)
    for (let gx = 0; gx < GW; gx++) {
      let lum = 0;
      let n = 0;
      for (let y = gy * C; y < Math.min(H, gy * C + C); y++)
        for (let x = gx * C; x < Math.min(W, gx * C + C); x++) {
          const i = (y * W + x) * 4;
          lum += 0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2];
          n++;
        }
      mask[gy * GW + gx] = lum / n > 30 ? 1 : 0;
    }
  const drawn = mask.reduce((a, b) => a + b, 0);
  // Where the image is drawn, in percent, ignoring stray specks (the outer 1% of drawn
  // cells each way): the site zooms the map to it.
  const cellsX = [];
  const cellsY = [];
  for (let gy = 0; gy < GH; gy++)
    for (let gx = 0; gx < GW; gx++) if (mask[gy * GW + gx]) cellsX.push(gx), cellsY.push(gy);
  cellsX.sort((a, b) => a - b);
  cellsY.sort((a, b) => a - b);
  const at = (a, f) => a[Math.floor((a.length - 1) * f)];
  const pct = (v, size) => Math.min(100, Math.round(((v * C) / size) * 1000) / 10);
  const crop = [pct(at(cellsX, 0.01), W), pct(at(cellsY, 0.01), H), pct(at(cellsX, 0.99) + 1, W), pct(at(cellsY, 0.99) + 1, H)];
  const sorted = (i) => pts.map((p) => p[i]).sort((a, b) => a - b);
  const q = (a, f) => a[Math.floor((a.length - 1) * f)];
  const xs = sorted(0);
  const ys = sorted(1);
  const spanX = q(xs, 0.98) - q(xs, 0.02);
  const spanY = q(ys, 0.98) - q(ys, 0.02);
  const midX = (q(xs, 0.98) + q(xs, 0.02)) / 2;
  const midY = (q(ys, 0.98) + q(ys, 0.02)) / 2;
  const hit = new Uint8Array(GW * GH);
  const score = (k, cx, cy) => {
    hit.fill(0);
    let on = 0;
    for (const [x, y] of pts) {
      const u = W / 2 - (y - cy) * k;
      const v = H / 2 - (x - cx) * k;
      if (u < 0 || v < 0 || u >= W || v >= H) continue;
      const gx = Math.floor(u / C);
      const gy = Math.floor(v / C);
      if (mask[gy * GW + gx]) on++;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const X = gx + dx;
          const Y = gy + dy;
          if (X >= 0 && Y >= 0 && X < GW && Y < GH) hit[Y * GW + X] = 1;
        }
    }
    let covered = 0;
    for (let i = 0; i < hit.length; i++) if (hit[i] && mask[i]) covered++;
    const P = on / pts.length;
    const R = covered / drawn;
    return { s: P && R ? (2 * P * R) / (P + R) : 0, P, R };
  };
  // The spawns can't be wider than the image, nor smaller than a fifth of it.
  const kMax = Math.min(W / spanY, H / spanX) * 1.05;
  let best = { s: -1 };
  let [kLo, kHi, xLo, xHi, yLo, yHi] = [kMax / 5, kMax, midX - spanX, midX + spanX, midY - spanY, midY + spanY];
  for (const steps of [40, 20, 20]) {
    for (let a = 0; a <= steps; a++)
      for (let b = 0; b <= steps; b++)
        for (let c = 0; c <= steps; c++) {
          const k = kLo + ((kHi - kLo) * a) / steps;
          const cx = xLo + ((xHi - xLo) * b) / steps;
          const cy = yLo + ((yHi - yLo) * c) / steps;
          const r = score(k, cx, cy);
          if (r.s > best.s) best = { ...r, k, cx, cy };
        }
    const [dk, dx, dy] = [((kHi - kLo) / steps) * 2, ((xHi - xLo) / steps) * 2, ((yHi - yLo) / steps) * 2];
    [kLo, kHi, xLo, xHi, yLo, yHi] = [best.k - dk, best.k + dk, best.cx - dx, best.cx + dx, best.cy - dy, best.cy + dy];
  }
  return { ...best, crop };
}
