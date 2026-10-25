// Downloads the raw WoW Forever data this site is built from into data-raw/.
// Run `npm run data:build` afterwards to turn it into src/data/generated/.
//
// Sources (all WoW Forever specific):
//   - wowforevertalents.com: class spellbooks, racials, professions and dungeons,
//     read by that site from the Forever client (build noted in its pages).
//   - wago.tools: raw DB2 tables from the Forever client (product "wowf").
//   - wowhead.com/forever: zone list plus each zone's quests and gathering nodes
//     ("wowhead"; capital cities too, for their class quests), every quest's page
//     ("quests", slow: ~3,000 pages, an hour or so) and item tooltips ("items", via
//     Wowhead's tooltip API).
//     Wowhead serves a JS challenge to plain HTTP clients, so pages are rendered in
//     a headless Chromium through playwright-core. Point CHROMIUM_PATH at a
//     Chrome/Chromium binary if it isn't found automatically.
//   - CMaNGOS classic-db ("cmangos"): Classic's creature spawns, for boss positions
//     in the dungeons Forever keeps unchanged (13 MB download).
//
// Usage: node scripts/fetch-sources.mjs [--only=wft,wago,wowhead,quests,items,cmangos] [--force[=steps]]
// --force re-downloads what is already in data-raw/; --force=wft,wowhead limits that to those steps.

import { mkdir, writeFile, readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  WAGO_BUILD,
  CLASSES,
  PROFESSIONS,
  ZONE_EXCLUDE,
  CITY_ZONE_IDS,
  NOT_A_QUEST,
  CMANGOS_DUMP,
  isClassQuestCategory,
} from './sources.mjs';
import { ATTUNEMENTS, INSTANCE_ZONES, DUNGEONS } from './curated.mjs';
import { dungeonSpawns } from './lib/cmangos.mjs';
import { findChromium } from './lib/chromium.mjs';
import { extractJsonScript, listviews } from './lib/wowhead.mjs';
import { parseQuestPage } from './lib/wowhead-quest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = path.join(root, 'data-raw');

const args = process.argv.slice(2);
const forceArg = args.find((a) => a === '--force' || a.startsWith('--force='));
const forceSteps = forceArg?.startsWith('--force=') ? new Set(forceArg.slice(8).split(',')) : null;
// Set per step below: whether this step re-downloads files it already has.
let force = false;
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

async function download(url, file, { binary = false } = {}) {
  if (!force && (await exists(file))) return false;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'wow-forever-helper data fetch' } });
    if (res.ok) {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, binary ? Buffer.from(await res.arrayBuffer()) : await res.text());
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
  for (const table of ['CharBaseInfo', 'ChrRaces', 'ChrClasses', 'DungeonEncounter']) {
    const url = `https://wago.tools/db2/${table}/csv?build=${WAGO_BUILD}`;
    const fetched = await download(url, path.join(rawDir, 'wago', `${table}.csv`));
    console.log(`${fetched ? 'fetched' : 'cached '} wago ${table}`);
  }
}

/**
 * A headless browser for Wowhead. Pages pass an AWS WAF check before they render,
 * so its scripts and styles load (a missing stylesheet sends it to an error page);
 * ads, trackers, images and fonts are blocked.
 */
async function openWowhead() {
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({
    executablePath: findChromium(),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0 Safari/537.36',
  });
  await context.route('**/*', (route) => {
    const req = route.request();
    const host = new URL(req.url()).hostname;
    const allowed = /(^|\.)(wowhead\.com|zamimg\.com|awswaf\.com)$/.test(host);
    if (!allowed || ['image', 'font', 'media'].includes(req.resourceType())) return route.abort();
    return route.continue();
  });
  return { browser, context };
}

/** Loads `url` and waits until `ready` (run in the page) is true, riding out the WAF reload. */
async function renderPage(page, url, ready, timeout = 45000) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    try {
      if (await page.evaluate(ready)) return await page.content();
    } catch {
      // The challenge reloads the page mid-check; try again.
    }
    await sleep(250);
  }
  throw new Error(`${url}: timed out`);
}

async function fetchWowhead() {
  const { browser, context } = await openWowhead();
  const page = await context.newPage();

  async function render(url, file, ready) {
    if (!force && (await exists(file))) return false;
    for (let attempt = 1; ; attempt++) {
      try {
        const html = await renderPage(page, url, ready);
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, html);
        return true;
      } catch (err) {
        if (attempt >= 3) throw err;
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
  const instanceIds = new Set(Object.values(INSTANCE_ZONES).flat());
  // Capital cities aren't leveling zones but are fetched for their class quests (trainers live there).
  const targets = zones.filter(
    (z) =>
      instanceIds.has(z.id) ||
      CITY_ZONE_IDS.includes(z.id) ||
      (z.instance === 0 &&
        [0, 1, -1].includes(z.category) &&
        !CITY_ZONE_IDS.includes(z.id) &&
        !ZONE_EXCLUDE.test(z.name) &&
        (z.minlevel > 0 || z.envChange?.status === 'new')),
  );
  for (const z of targets) {
    const fetched = await render(
      `https://www.wowhead.com/forever/zone=${z.id}`,
      path.join(rawDir, 'wowhead', `zone-${z.id}.html`),
      () => document.readyState !== 'loading' && document.title.includes(' - Zone - '),
    );
    console.log(`${fetched ? 'rendered' : 'cached  '} wowhead zone ${z.id} ${z.name}`);
    if (fetched) await sleep(1000);
  }
  await browser.close();
}

/**
 * Quest ids filed under each fetched zone or instance, the class quests its page lists
 * (Wowhead files those under the class), plus the attunement chains' last quests.
 */
async function questIds() {
  const ids = new Set();
  for (const file of await readdir(path.join(rawDir, 'wowhead'))) {
    const m = /^zone-(\d+)\.html$/.exec(file);
    if (!m) continue;
    const zoneId = Number(m[1]);
    for (const q of listviews(await readFile(path.join(rawDir, 'wowhead', file), 'utf8')).quests ?? []) {
      const listed = q.category === zoneId || isClassQuestCategory(q.category);
      if (listed && q.level > 0 && !NOT_A_QUEST.test(q.name)) ids.add(q.id);
    }
  }
  for (const list of Object.values(ATTUNEMENTS)) for (const a of list) ids.add(a.quest);
  return ids;
}

/**
 * Each quest's page: givers, map coordinates, chain and rewards. Parsed on the spot
 * and saved as data-raw/wowhead/quests/<id>.json (the pages themselves are large).
 * Chains are followed into other zones a few steps deep. Resumable: quests already
 * saved are skipped. QUEST_CONCURRENCY sets parallel pages (default 3).
 */
async function fetchQuests() {
  const dir = path.join(rawDir, 'wowhead', 'quests');
  await mkdir(dir, { recursive: true });
  const ids = await questIds();
  const workers = Number(process.env.QUEST_CONCURRENCY ?? 3);
  let done = 0;

  async function crawl(context, todo) {
    const queue = [...todo];
    let browserGone = false;
    let timeouts = 0;
    await Promise.all(
      Array.from({ length: workers }, async () => {
        const page = await context.newPage();
        for (let id = queue.shift(); id !== undefined && !browserGone; id = queue.shift()) {
          let record = null;
          for (let attempt = 1; attempt <= 2 && !record && !browserGone; attempt++) {
            try {
              const html = await renderPage(
                page,
                `https://www.wowhead.com/forever/quest=${id}`,
                // The quest's facts box, or Wowhead's redirect for a quest it doesn't have.
                () =>
                  document.readyState !== 'loading' &&
                  (!!document.getElementById('infobox-contents-0') || location.search.includes('notFound=')),
                30000,
              );
              record = parseQuestPage(id, html) ?? { id, missing: true };
              timeouts = 0;
            } catch (err) {
              // A crashed browser ends this pass, and so do repeated timeouts: the WAF has
              // soured on this browser's session, and a fresh one gets through again.
              if (/has been closed|Target closed/.test(err.message) || ++timeouts >= workers + 1) {
                console.warn(`quests: restarting the browser (${err.message})`);
                browserGone = true;
              } else await sleep(3000 * attempt);
            }
          }
          if (record) await writeFile(path.join(dir, `${id}.json`), JSON.stringify(record));
          if (record && ++done % 50 === 0) console.log(`quests: ${done} fetched`);
          await sleep(300);
        }
        await page.close().catch(() => {});
      }),
    );
  }

  // Each pass gets a fresh browser; stop when everything is in or a few passes in a row get
  // nothing (the WAF sometimes turns a whole pass away, and lets the next one through).
  for (let pass = 0, before = -1, idle = 0; pass < 80 && idle < 4; pass++) {
    if (done === before) {
      idle++;
      await sleep(60000);
    } else idle = 0;
    before = done;
    const todo = [];
    for (const id of ids) if ((force && pass === 0) || !(await exists(path.join(dir, `${id}.json`)))) todo.push(id);
    console.log(`quests pass ${pass + 1}: ${todo.length} to fetch of ${ids.size}`);
    if (!todo.length) break;
    const { browser, context } = await openWowhead();
    try {
      await crawl(context, todo);
    } finally {
      await browser.close().catch(() => {});
    }
    // Chains: pull in every quest named in a fetched quest's series.
    for (const file of await readdir(dir)) {
      const q = JSON.parse(await readFile(path.join(dir, file), 'utf8'));
      for (const step of q.series ?? []) for (const s of step) ids.add(s.id);
    }
  }
}

/** Classic creature spawns in the dungeons' maps, from the CMaNGOS database dump. */
async function fetchCmangos() {
  const dump = path.join(rawDir, 'cmangos', path.basename(CMANGOS_DUMP));
  console.log(`${(await download(CMANGOS_DUMP, dump, { binary: true })) ? 'fetched' : 'cached '} cmangos dump`);
  const maps = [...new Set(DUNGEONS.map((d) => d.map).filter(Boolean))];
  const out = await dungeonSpawns(dump, maps);
  await writeFile(path.join(rawDir, 'cmangos', 'dungeon-spawns.json'), JSON.stringify(out));
  console.log(`cmangos: ${out.spawns.length} spawns in ${maps.length} dungeon maps`);
}

/** Item tooltips (quest rewards, crafted items, reagents) from Wowhead's tooltip API. */
async function fetchItems() {
  const dir = path.join(rawDir, 'wowhead', 'items');
  await mkdir(dir, { recursive: true });
  const ids = new Set();
  const questDir = path.join(rawDir, 'wowhead', 'quests');
  for (const file of (await exists(questDir)) ? await readdir(questDir) : []) {
    const q = JSON.parse(await readFile(path.join(questDir, file), 'utf8'));
    for (const [id] of [...(q.rewards?.choices ?? []), ...(q.rewards?.items ?? [])]) ids.add(id);
  }
  for (const p of PROFESSIONS) {
    const html = await readFile(path.join(rawDir, 'wft', `profession-${p.slug}.html`), 'utf8');
    for (const m of html.matchAll(/wowhead\.com\/(?:forever|classic)\/item=(\d+)/g)) ids.add(Number(m[1]));
  }
  const todo = [];
  for (const id of ids) if (force || !(await exists(path.join(dir, `${id}.json`)))) todo.push(id);
  console.log(`items: ${todo.length} to fetch of ${ids.size}`);
  let done = 0;
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let id = todo.shift(); id !== undefined; id = todo.shift()) {
        try {
          const res = await fetch(`https://nether.wowhead.com/forever/tooltip/item/${id}?dataEnv=16&locale=0`);
          // A 404 ({"error":"Entity not found"}) is an item Forever doesn't have; keep it so it isn't retried.
          if (res.ok || res.status === 404) await writeFile(path.join(dir, `${id}.json`), await res.text());
          else console.warn(`item ${id}: HTTP ${res.status}`);
        } catch (err) {
          console.warn(`item ${id}: ${err.message}`);
        }
        if (++done % 200 === 0) console.log(`items: ${done} fetched`);
        await sleep(100);
      }
    }),
  );
}

const steps = { wft: fetchWft, wago: fetchWago, wowhead: fetchWowhead, quests: fetchQuests, items: fetchItems, cmangos: fetchCmangos };
for (const [name, run] of Object.entries(steps)) {
  if (!want(name)) continue;
  force = !!forceArg && (!forceSteps || forceSteps.has(name));
  await run();
}
console.log('done');
