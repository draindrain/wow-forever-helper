// Downloads the raw WoW Forever data this site is built from into data-raw/.
// Run `npm run data:build` afterwards to turn it into src/data/generated/.
//
// Sources (all WoW Forever specific):
//   - wowforevertalents.com: class spellbooks, racials, professions and dungeons,
//     read by that site from the Forever client (build noted in its pages).
//   - wago.tools: raw DB2 tables from the Forever client (product "wowf").
//   - wowhead.com/forever: zone list plus each zone's quests and gathering nodes.
//     Wowhead serves a JS challenge to plain HTTP clients, so these pages are
//     rendered in a headless Chromium through playwright-core. Point CHROMIUM_PATH
//     at a Chrome/Chromium binary if it isn't found automatically.
//
// Usage: node scripts/fetch-sources.mjs [--only=wft,wago,wowhead] [--force]

import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WAGO_BUILD, CLASSES, PROFESSIONS, ZONE_EXCLUDE, CITY_ZONE_IDS } from './sources.mjs';
import { extractJsonScript } from './lib/wowhead.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = path.join(root, 'data-raw');

const args = process.argv.slice(2);
const force = args.includes('--force');
const onlyArg = args.find((a) => a.startsWith('--only='));
const only = onlyArg ? new Set(onlyArg.slice(7).split(',')) : null;
const want = (name) => !only || only.has(name);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function download(url, file) {
  if (!force && (await exists(file))) return false;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'wow-forever-helper data fetch' } });
    if (res.ok) {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, await res.text());
      return true;
    }
    if (attempt >= 4) throw new Error(`${url} -> HTTP ${res.status}`);
    await sleep(2000 * 2 ** (attempt - 1));
  }
}

async function fetchWft() {
  const base = 'https://wowforevertalents.com';
  const pages = [
    ...CLASSES.map((c) => [`/abilities/${c}/`, `abilities-${c}.html`]),
    ...PROFESSIONS.map((p) => [`/professions/${p.slug}/`, `profession-${p.slug}.html`]),
    ['/racials/', 'racials.html'],
    ['/dungeons/', 'dungeons.html'],
  ];
  for (const [urlPath, name] of pages) {
    const fetched = await download(base + urlPath, path.join(rawDir, 'wft', name));
    console.log(`${fetched ? 'fetched' : 'cached '} wft ${urlPath}`);
    if (fetched) await sleep(500);
  }
}

async function fetchWago() {
  for (const table of ['CharBaseInfo', 'ChrRaces', 'ChrClasses']) {
    const url = `https://wago.tools/db2/${table}/csv?build=${WAGO_BUILD}`;
    const fetched = await download(url, path.join(rawDir, 'wago', `${table}.csv`));
    console.log(`${fetched ? 'fetched' : 'cached '} wago ${table}`);
  }
}

function findChromium() {
  const candidates = [
    process.env.CHROMIUM_PATH,
    '/opt/pw-browsers/chromium',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error('No Chrome/Chromium found; set CHROMIUM_PATH to fetch Wowhead pages.');
  return found;
}

async function fetchWowhead() {
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox'] });
  const page = await browser.newPage({
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0 Safari/537.36',
  });
  // Images, fonts and media aren't needed for the embedded data.
  await page.route('**/*', (route) =>
    ['image', 'font', 'media'].includes(route.request().resourceType()) ? route.abort() : route.continue(),
  );

  async function render(url, file, ready) {
    if (!force && (await exists(file))) return false;
    for (let attempt = 1; ; attempt++) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      try {
        await page.waitForFunction(ready, null, { timeout: 30000 });
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, await page.content());
        return true;
      } catch (err) {
        if (attempt >= 3) throw new Error(`${url}: ${err.message}`);
        await sleep(5000 * attempt);
      }
    }
  }

  const listFile = path.join(rawDir, 'wowhead', 'zones.html');
  await render('https://www.wowhead.com/forever/zones', listFile, () =>
    document.getElementById('data.page.listPage.listviews'),
  );
  console.log('rendered wowhead zone list');

  const zones = JSON.parse(extractJsonScript(await readFile(listFile, 'utf8'), 'data.page.listPage.listviews'))[0]
    .data;
  const targets = zones.filter(
    (z) =>
      z.instance === 0 &&
      [0, 1, -1].includes(z.category) &&
      !CITY_ZONE_IDS.includes(z.id) &&
      !ZONE_EXCLUDE.test(z.name) &&
      (z.minlevel > 0 || z.envChange?.status === 'new'),
  );
  for (const z of targets) {
    const fetched = await render(
      `https://www.wowhead.com/forever/zone=${z.id}`,
      path.join(rawDir, 'wowhead', `zone-${z.id}.html`),
      () => document.documentElement.innerHTML.includes("template: 'quest'") || document.title.includes('Zone'),
    );
    console.log(`${fetched ? 'rendered' : 'cached  '} wowhead zone ${z.id} ${z.name}`);
    if (fetched) await sleep(1500);
  }
  await browser.close();
}

if (want('wft')) await fetchWft();
if (want('wago')) await fetchWago();
if (want('wowhead')) await fetchWowhead();
console.log('done');
