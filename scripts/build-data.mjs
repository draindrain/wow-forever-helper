// Turns the raw downloads in data-raw/ (see fetch-sources.mjs) into the JSON
// the site loads from src/data/generated/.

import { readFile, writeFile, mkdir, readdir, rm, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';
import { WAGO_BUILD, CLASSES, PROFESSIONS, NOT_A_QUEST, CITY_ZONE_IDS, isClassQuestCategory } from './sources.mjs';
import {
  SPECS,
  RACES,
  DUNGEONS,
  RAIDS,
  BATTLEGROUNDS,
  PROFESSION_RANKS,
  MILESTONES,
  ZONE_OVERRIDES,
  INSTANCE_ZONES,
  ATTUNEMENTS,
  PINNED_MAPS,
  BOSS_SPAWNS,
} from './curated.mjs';
import { extractJsonScript, listviews } from './lib/wowhead.mjs';
import { parseItemTooltip } from './lib/item-tooltip.mjs';
import { parseCsv } from './lib/csv.mjs';
import { encounterBosses } from './lib/encounters.mjs';
import { bossPins } from './lib/boss-pins.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = (...p) => path.join(root, 'data-raw', ...p);
const outDir = path.join(root, 'src', 'data', 'generated');

const readText = (file) => readFile(file, 'utf8');
const text = (el) => (el ? el.text.replace(/\s+/g, ' ').trim() : '');
// Icons come from Wowhead's CDN; store only the file name.
const iconName = (src) => (src ? path.basename(src).replace(/\.jpg$/, '') : '');
const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);

async function writeJson(rel, data) {
  const file = path.join(outDir, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data) + '\n');
}

const fileExists = (file) =>
  access(file).then(
    () => true,
    () => false,
  );

// ---------------------------------------------------------------- item tooltips

const itemTips = new Map();
/** Tooltip lines for an item from data-raw/wowhead/items (see fetch-sources "items"), or null. */
async function itemTip(id) {
  if (!itemTips.has(id)) {
    const file = raw('wowhead', 'items', `${id}.json`);
    itemTips.set(id, (await fileExists(file)) ? parseItemTooltip(JSON.parse(await readText(file))) : null);
  }
  return itemTips.get(id);
}

// ---------------------------------------------------------------- classes

const RACE_TAGS = ['Human', 'Dwarf', 'Night Elf', 'Gnome', 'Orc', 'Undead', 'Tauren', 'Troll', 'Skyborne'];

function cleanMeta(meta, classId) {
  // The client lists a pet "Happiness" cost beside every Rage cost; drop it outside hunters.
  return classId === 'hunter' ? meta : meta.replace(/ \/ \d+ Happiness/, '');
}

async function buildClass(classId) {
  const doc = parse(await readText(raw('wft', `abilities-${classId}.html`)));
  const name = titleCase(classId);
  const schools = doc.querySelectorAll('[role=tab]').map((t) => text(t));
  const spells = [];
  for (const panel of doc.querySelectorAll('section.book-panel')) {
    const tabId = panel.getAttribute('aria-labelledby');
    const school = text(doc.querySelector(`#${tabId}`));
    for (const cell of panel.querySelectorAll('li.cell')) {
      const tip = JSON.parse(cell.querySelector('button').getAttribute('data-tip'));
      if (tip.s === 'removed') continue;
      const tags = tip.t.filter((t) => t !== 'Talent rank 1');
      spells.push({
        name: tip.n,
        icon: iconName(cell.querySelector('img')?.getAttribute('src')),
        school,
        status: tip.s,
        passive: tip.p || undefined,
        races: tags.filter((t) => RACE_TAGS.includes(t)),
        faction: tags.find((t) => t === 'Alliance' || t === 'Horde'),
        note: tip.no || undefined,
        unconfirmed: /not yet seen on the Forever beta/.test(tip.no) || undefined,
        talent: tip.tr ? { tree: tip.tr.tt, level: tip.tr.l } : undefined,
        ranks: tip.k.map((k) => ({
          rank: k.r || undefined,
          level: k.l,
          meta: cleanMeta(k.m, classId) || undefined,
          desc: k.d,
        })),
      });
    }
  }

  // "What a <class> can wear and hold", with the level each one unlocks.
  const equipment = [];
  for (const item of doc.querySelectorAll('li.prof-item')) {
    const lvl = /Level (\d+)/.exec(text(item.querySelector('.prof-lvl')));
    equipment.push({
      name: text(item.querySelector('.prof-name')),
      icon: iconName(item.querySelector('img')?.getAttribute('src')),
      level: lvl ? Number(lvl[1]) : 1,
    });
  }
  const dual = /dual wield from level (\d+)/i.exec(doc.text);
  if (dual) equipment.push({ name: 'Dual Wield', icon: 'ability_dualwield', level: Number(dual[1]) });

  const specs = SPECS[classId];
  for (const spec of specs) {
    if (!schools.includes(spec.school)) throw new Error(`${classId}: no spellbook school "${spec.school}"`);
  }
  for (const s of spells) {
    if (s.talent && !specs.some((sp) => sp.school === s.talent.tree)) {
      throw new Error(`${classId}: talent tree "${s.talent.tree}" (${s.name}) matches no spec`);
    }
  }
  await writeJson(`classes/${classId}.json`, { id: classId, name, schools, spells, equipment });
  console.log(`class ${classId}: ${spells.length} spells, ${equipment.length} equipment rows`);
  return { id: classId, name, specs };
}

// ---------------------------------------------------------------- races

async function buildRaces(classMeta) {
  const csvRows = async (t) => parseCsv(await readText(raw('wago', `${t}.csv`)));
  const chrRaces = new Map((await csvRows('ChrRaces')).map((r) => [Number(r.ID), r]));
  const chrClasses = new Map((await csvRows('ChrClasses')).map((r) => [Number(r.ID), r]));
  const combos = await csvRows('CharBaseInfo');

  // Racial traits and the ★ new-combination marks from the racials page.
  const doc = parse(await readText(raw('wft', 'racials.html')));
  const cards = new Map();
  for (const card of doc.querySelectorAll('.card')) {
    const raceName = text(card.querySelector('h3'));
    if (!raceName) continue;
    const newClasses = card
      .querySelectorAll('.race-class')
      .filter((a) => a.querySelector('.mark, .flag, i'))
      .map((a) => text(a.querySelector('span')).toLowerCase());
    const racials = card
      .querySelectorAll('li.ability')
      .filter((li) => !li.classList.contains('ability-removed'))
      .map((li) => {
        const nameEl = li.querySelector('.ability-name');
        const variants = li.querySelectorAll('.ability-variants li').map(text);
        return {
          name: text(nameEl).replace(/\s*Passive\s*/, ' ').replace(/[★◆✓✕]/g, '').trim(),
          icon: iconName(li.querySelector('img')?.getAttribute('src')),
          passive: /Passive/.test(text(nameEl)) || undefined,
          desc: variants.length ? variants.join(' / ') : text(li.querySelector('.ability-text')),
          meta: text(li.querySelector('.ability-meta')) || undefined,
        };
      });
    cards.set(raceName, { icon: iconName(card.querySelector('header img')?.getAttribute('src')), newClasses, racials });
  }

  const classIds = new Set(classMeta.map((c) => c.id));
  const races = RACES.map((r) => {
    const row = chrRaces.get(r.clientId);
    if (!row) throw new Error(`race ${r.clientId} missing from ChrRaces`);
    const name = r.display ?? row.Name_lang;
    const card = cards.get(name) ?? cards.get(name === 'Undead' ? 'Forsaken' : name);
    if (!card) throw new Error(`no racials card for ${name}`);
    const classes = combos
      .filter((c) => Number(c.RaceID) === r.clientId)
      .map((c) => chrClasses.get(Number(c.ClassID)).Name_lang.toLowerCase())
      .filter((c) => classIds.has(c));
    return {
      id: r.id,
      name,
      faction: row.Alliance === '0' ? 'Alliance' : 'Horde',
      classes: CLASSES.filter((c) => classes.includes(c)),
      newClasses: card.newClasses.filter((c) => classes.includes(c)),
      startZone: r.startZone,
      icon: card.icon,
      racials: card.racials,
    };
  });
  for (const r of races) console.log(`race ${r.name} (${r.faction}): ${r.classes.join(', ')}; new: ${r.newClasses.join(', ') || '-'}`);
  return races;
}

// ---------------------------------------------------------------- professions

async function buildProfession(prof) {
  const doc = parse(await readText(raw('wft', `profession-${prof.slug}.html`)));
  const recipes = [];
  for (const group of doc.querySelectorAll('section.pw-group')) {
    // The "Not in Forever" group lists Classic recipes the Forever client dropped.
    if (group.classList.contains('kind-removed')) continue;
    const heading = text(group.querySelector('.pw-group-name'));
    for (const row of group.querySelectorAll('li.pw-row')) {
      if (row.getAttribute('data-status') === 'removed') continue;
      const num = (attr) => (row.getAttribute(attr) ? Number(row.getAttribute(attr)) : undefined);
      const nameEl = row.querySelector('.pw-row-name');
      // A trailing tag marks a one-faction recipe (e.g. Faction Banner).
      const tag = text(nameEl.querySelector('.pw-row-tag'));
      nameEl.querySelector('.pw-row-tag')?.remove();
      const teacher = row.querySelector('.rd-teachers li span');
      const product = /item=(\d+)/.exec(row.querySelector('a.pw-row-btn')?.getAttribute('href') ?? '')?.[1];
      const tip = product ? await itemTip(Number(product)) : null;
      recipes.push({
        id: Number(row.getAttribute('data-r')),
        name: text(nameEl).replace(/[★◆✕]/g, '').trim(),
        faction: tag === 'Alliance' || tag === 'Horde' ? tag : undefined,
        icon: iconName(row.querySelector('img')?.getAttribute('src')),
        heading,
        status: row.getAttribute('data-status'),
        source: row.getAttribute('data-src'),
        taughtBy: row.getAttribute('data-src') === 'item' ? text(teacher) || undefined : undefined,
        learn: num('data-learn'),
        yellow: num('data-yellow'),
        green: num('data-green'),
        grey: num('data-grey'),
        quality: Number(/\bq(\d)\b/.exec(row.querySelector('.rd-name')?.getAttribute('class') ?? '')?.[1] ?? 1),
        reagents: row.querySelectorAll('.rd-reagents li').map((li) => ({
          name: text(li.querySelector('.rd-reagent-name')),
          count: Number(text(li.querySelector('.rd-count')) || 1),
        })),
        // What it makes, as the game's item tooltip shows it.
        product: tip ? { name: tip.name, quality: tip.quality, lines: tip.lines } : undefined,
      });
    }
  }
  // Recipes that moved between professions are listed on both pages; keep this page's own.
  const unique = [...new Map(recipes.map((r) => [r.id, r])).values()];
  await writeJson(`professions/${prof.slug}.json`, unique);
  console.log(`profession ${prof.slug}: ${unique.length} recipes`);
  return { id: prof.slug, name: prof.name, kind: prof.kind, recipes: unique.length };
}

// ---------------------------------------------------------------- dungeons

async function buildInstances() {
  const doc = parse(await readText(raw('wft', 'dungeons.html')));
  const client = new Map();
  for (const row of doc.querySelectorAll('li.df-row')) {
    const detail = parse(row.querySelector('template')?.innerHTML ?? '');
    const entry = /from level (\d+)/.exec(text(detail.querySelector('.idt-entries')));
    client.set(row.getAttribute('data-i'), {
      finderLevel: row.getAttribute('data-target') ? Number(row.getAttribute('data-target')) : undefined,
      entryLevel: entry ? Number(entry[1]) : undefined,
      players: Number(text(row.querySelector('.df-players'))) || undefined,
      changed: row.getAttribute('data-status') === 'changed',
    });
  }
  // Bosses come from the client's encounter table: wowforevertalents' boss lists pick up
  // trash (Defias Watchman in the Deadmines) and miss bosses (Edwin VanCleef).
  const encounters = parseCsv(await readText(raw('wago', 'DungeonEncounter.csv')));
  const dungeons = DUNGEONS.map((d) => {
    const c = client.get(d.client);
    if (!c) throw new Error(`dungeon ${d.id}: no client row "${d.client}"`);
    const all = d.map ? encounterBosses(encounters, d.map) : [];
    const bosses = d.bosses ? all.filter((b) => d.bosses.includes(b)) : all;
    if (d.bosses && bosses.length !== d.bosses.length) throw new Error(`dungeon ${d.id}: wing bosses not in the client`);
    const { client: _slug, bosses: _wing, map: _map, ...rest } = d;
    return {
      ...rest,
      entryLevel: c.entryLevel,
      players: c.players ?? 5,
      changed: !d.isNew && c.changed ? true : undefined,
      bosses,
      // Announced dungeons missing from this client build have no boss list yet.
      inClient: all.length > 0,
    };
  });
  await writeJson('instances.json', { dungeons, raids: RAIDS, battlegrounds: BATTLEGROUNDS });
  console.log(`instances: ${dungeons.length} dungeons`);
  return dungeons;
}

// ---------------------------------------------------------------- zones

const CONTINENTS = { 0: 'Eastern Kingdoms', 1: 'Kalimdor', [-1]: 'Skywall' };
const TERRITORY = { 0: 'Alliance', 1: 'Horde', 2: 'Contested', 3: 'Sanctuary' };
// A zone counts as a leveling zone for a faction with at least this many quests
// it can take; in the other faction's territory they must be its own quests.
const MIN_QUESTS = 10;
const MIN_OWN_QUESTS_IN_ENEMY_TERRITORY = 6;

function percentile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)))];
}

async function buildZones(races) {
  const list = JSON.parse(extractJsonScript(await readText(raw('wowhead', 'zones.html')), 'data.page.listPage.listviews'))[0]
    .data;
  const byId = new Map(list.map((z) => [z.id, z]));
  // Dungeon, raid and capital city pages are fetched for their quests; they aren't leveling zones.
  const skip = new Set([...Object.values(INSTANCE_ZONES).flat(), ...CITY_ZONE_IDS]);
  const files = (await readdir(raw('wowhead'))).filter(
    (f) => /^zone-\d+\.html$/.test(f) && !skip.has(Number(/\d+/.exec(f)[0])),
  );
  const zones = [];
  for (const file of files) {
    const id = Number(/\d+/.exec(file)[0]);
    const meta = byId.get(id);
    const lv = listviews(await readText(raw('wowhead', file)));
    const override = ZONE_OVERRIDES[id] ?? {};
    // Quests filed under this zone; holiday and class quests file elsewhere.
    // Max-level turn-ins (crate donations and the like) sit far above a zone's
    // own range, so anything 5+ levels past Wowhead's zone maximum is dropped.
    const ceiling = meta.maxlevel > 0 ? meta.maxlevel + 5 : 60;
    const quests = (lv.quests ?? []).filter(
      (q) => q.category === id && q.level > 0 && q.level <= ceiling && !NOT_A_QUEST.test(q.name),
    );
    const factions = {};
    for (const [faction, side] of [['Alliance', 1], ['Horde', 2]]) {
      const enemyTerritory = meta.territory === (side === 1 ? 1 : 0);
      const own = quests.filter((q) => q.side === side).length;
      let levels = quests
        .filter((q) => q.side === side || q.side === 3 || q.side === undefined)
        .map((q) => q.level)
        .sort((a, b) => a - b);
      // Endgame chains that start in leveling zones (Onyxia's in Dustwallow, for one)
      // sit far above the zone's own quests.
      const median = levels[Math.floor(levels.length / 2)];
      levels = levels.filter((l) => l <= median + 15);
      if (enemyTerritory && own < MIN_OWN_QUESTS_IN_ENEMY_TERRITORY) continue;
      if (levels.length < MIN_QUESTS) {
        if (override.range && !enemyTerritory) {
          factions[faction] = { min: override.range[0], max: override.range[1], quests: levels.length, histogram: {}, estimated: true };
        }
        continue;
      }
      const histogram = {};
      for (const l of levels) histogram[l] = (histogram[l] ?? 0) + 1;
      const min = percentile(levels, 0.1);
      factions[faction] = {
        // Starting zones begin at level 1 even though their first quests are a level or two up.
        min: min <= 5 ? 1 : min,
        max: percentile(levels, 0.9),
        quests: levels.length,
        histogram,
      };
    }
    if (!Object.keys(factions).length) continue;

    // Herbs (-3) and mining veins (-4) with the skill each needs.
    const nodes = new Map();
    for (const o of lv.objects ?? []) {
      if ((o.type !== -3 && o.type !== -4) || !o.skill) continue;
      const key = o.name;
      if (!nodes.has(key) || nodes.get(key).skill > o.skill) {
        nodes.set(key, { name: o.name, kind: o.type === -3 ? 'herb' : 'ore', skill: o.skill });
      }
    }
    zones.push({
      id,
      name: meta.name,
      continent: CONTINENTS[meta.category] ?? 'Other',
      territory: TERRITORY[meta.territory] ?? 'Contested',
      races: override.races,
      note: override.note,
      isNew: meta.envChange?.status === 'new' || undefined,
      updated: meta.envChange?.status === 'updated' || undefined,
      wowheadRange: meta.minlevel ? [meta.minlevel, meta.maxlevel] : undefined,
      factions,
      nodes: [...nodes.values()].sort((a, b) => a.skill - b.skill),
    });
  }
  // Two Wowhead zones can share a name (e.g. a phased copy); keep the one with more quests.
  const byName = new Map();
  const total = (z) => Object.values(z.factions).reduce((n, f) => n + f.quests, 0);
  for (const z of zones) if (!byName.has(z.name) || total(byName.get(z.name)) < total(z)) byName.set(z.name, z);
  const result = [...byName.values()].sort(
    (a, b) => Math.min(...Object.values(a.factions).map((f) => f.min)) - Math.min(...Object.values(b.factions).map((f) => f.min)),
  );
  for (const r of races) {
    if (!result.some((z) => z.id === r.startZone)) throw new Error(`start zone ${r.startZone} for ${r.name} missing`);
  }
  await writeJson('zones.json', result);
  for (const z of result) {
    const f = Object.entries(z.factions).map(([k, v]) => `${k[0]} ${v.min}-${v.max} (${v.quests}q)`).join(', ');
    console.log(`zone ${z.name}: ${f}; nodes ${z.nodes.length}`);
  }
  return result;
}

/**
 * Capital cities aren't leveling zones, but the quests filed under them (many send you
 * elsewhere) get a quest view and a row of their own. Ranges span all their quests.
 */
async function buildCities() {
  const list = JSON.parse(extractJsonScript(await readText(raw('wowhead', 'zones.html')), 'data.page.listPage.listviews'))[0]
    .data;
  const byId = new Map(list.map((z) => [z.id, z]));
  const cities = [];
  for (const id of CITY_ZONE_IDS) {
    const meta = byId.get(id);
    const file = raw('wowhead', `zone-${id}.html`);
    if (!meta || !(await fileExists(file))) continue;
    const quests = (listviews(await readText(file)).quests ?? []).filter(
      (q) => q.category === id && q.level > 0 && !NOT_A_QUEST.test(q.name),
    );
    const factions = {};
    for (const [faction, side] of [['Alliance', 1], ['Horde', 2]]) {
      const enemyTerritory = meta.territory === (side === 1 ? 1 : 0);
      if (enemyTerritory && !quests.some((q) => q.side === side)) continue;
      const levels = quests
        .filter((q) => q.side === side || q.side === 3 || q.side === undefined)
        .map((q) => q.level)
        .sort((a, b) => a - b);
      if (!levels.length) continue;
      const histogram = {};
      for (const l of levels) histogram[l] = (histogram[l] ?? 0) + 1;
      factions[faction] = { min: levels[0], max: levels.at(-1), quests: levels.length, histogram };
    }
    if (!Object.keys(factions).length) continue;
    cities.push({
      id,
      name: meta.name,
      continent: CONTINENTS[meta.category] ?? 'Other',
      territory: TERRITORY[meta.territory] ?? 'Contested',
      isNew: meta.envChange?.status === 'new' || undefined,
      factions,
      nodes: [],
    });
  }
  // Wowhead has two Stormwind Cities (16509 and 1519); as with zones, keep the one with more quests.
  const byName = new Map();
  const total = (c) => Object.values(c.factions).reduce((n, f) => n + f.quests, 0);
  for (const c of cities) if (!byName.has(c.name) || total(byName.get(c.name)) < total(c)) byName.set(c.name, c);
  const result = [...byName.values()];
  await writeJson('cities.json', result);
  for (const c of result) {
    const f = Object.entries(c.factions).map(([k, v]) => `${k[0]} ${v.quests}q`).join(', ');
    console.log(`city ${c.name}: ${f}`);
  }
  return result;
}

// ---------------------------------------------------------------- quests

const SIDES = { 1: 'Alliance', 2: 'Horde' };

// Client class and race ids (as quest pages list them) -> this site's ids. Set by buildQuests.
let questIds = { classes: new Map(), races: new Map() };
const siteIds = (ids, map) => {
  const out = Array.isArray(ids) ? ids.map((id) => map.get(id)).filter(Boolean) : [];
  return out.length ? out : undefined;
};

async function loadQuestRecords() {
  const dir = raw('wowhead', 'quests');
  const records = new Map();
  if (!(await fileExists(dir))) return records;
  for (const file of await readdir(dir)) {
    const q = JSON.parse(await readText(path.join(dir, file)));
    if (!q.missing) records.set(q.id, q);
  }
  return records;
}

/** Quests Wowhead files under a zone or instance page, as listview rows. */
async function zoneQuestRows(zoneId) {
  const file = raw('wowhead', `zone-${zoneId}.html`);
  if (!(await fileExists(file))) return [];
  return (listviews(await readText(file)).quests ?? []).filter(
    (q) => q.category === zoneId && q.level > 0 && !NOT_A_QUEST.test(q.name),
  );
}

/** Ids of the quests any fetched page files under a class (see CLASS_QUEST_CATEGORIES). */
async function classCategoryQuestIds() {
  const ids = new Set();
  for (const file of await readdir(raw('wowhead'))) {
    if (!/^zone-\d+\.html$/.test(file)) continue;
    for (const q of listviews(await readText(raw('wowhead', file))).quests ?? []) {
      if (isClassQuestCategory(q.category)) ids.add(q.id);
    }
  }
  return ids;
}

// Wowhead lists instance NPCs with an empty position ([""]).
const isCoord = (c) => Array.isArray(c) && c.length === 2 && c.every(Number.isFinite);

// Zone id -> continent, for the zones and cities the site lists (set in buildQuests).
let continentOf = new Map();

/**
 * Zones a quest starts in. A giver can stand in several zones (shaman totem quests'
 * Manifestations of Earth are one NPC in Durotar, Mulgore and Dun Morogh, with a quest per
 * race); when the quest is turned in in one of them, that one is its zone, or else the ones
 * on the turn-in's continent (the Horde's Call of Fire brazier also stands in Loch Modan).
 */
function startZones(q) {
  const zones = [...new Set(q.points.filter((p) => p.point === 'start').map((p) => p.zone))];
  const ends = new Set(q.points.filter((p) => p.point === 'end').map((p) => p.zone));
  const home = zones.filter((z) => ends.has(z));
  if (home.length) return home;
  const endContinents = new Set([...ends].map((z) => continentOf.get(z)).filter(Boolean));
  const near = zones.filter((z) => endContinents.has(continentOf.get(z)));
  return near.length ? near : zones;
}

/** A giver with its map position, preferring a point in `zoneId`, then in the quest's own zone. */
function giverOut(q, which, zoneId) {
  const points = q.points.filter((p) => p.point === which);
  const own = which === 'start' ? startZones(q) : [];
  const p = points.find((x) => x.zone === zoneId) ?? points.find((x) => own.includes(x.zone)) ?? points[0];
  const g = q[which];
  if (!g && !p) return undefined;
  const coord = isCoord(p?.coord) ? p.coord : undefined;
  return { name: g?.name ?? p.name, kind: g?.kind ?? 'npc', zone: p?.zone, zoneName: p?.zoneName, coord };
}

/**
 * Writes a bundle of quests: each quest with givers, chain position and rewards,
 * the chains they belong to (with steps from other zones), and the reward items' tooltips.
 */
async function questBundle(rows, records, zoneId, extraIds = []) {
  const quests = [];
  const chains = {};
  const items = {};
  const seen = new Set();
  const add = async (id, row) => {
    if (seen.has(id)) return;
    seen.add(id);
    const q = records.get(id);
    if (!q && !row) return;
    const rewards = q?.rewards ?? {
      choices: row.itemchoices ?? [],
      items: row.itemrewards ?? [],
      xp: row.xp,
      money: row.money ?? 0,
      rep: [],
    };
    for (const [itemId] of [...rewards.choices, ...rewards.items]) {
      const tip = await itemTip(itemId);
      if (tip) items[itemId] = tip;
    }
    let chain;
    if (q?.series) {
      const key = String(q.series[0][0].id);
      const step = q.series.findIndex((s) => s.some((x) => x.id === id)) + 1;
      chain = { id: key, step, length: q.series.length };
      chains[key] ??= q.series.map((s) =>
        s.map((x) => {
          const r = records.get(x.id);
          return { id: x.id, name: x.name, level: r?.level, side: r?.side, zone: giverOut(r ?? { points: [] }, 'start')?.zoneName };
        }),
      );
    }
    quests.push({
      id,
      name: q?.name ?? row.name,
      level: q?.level ?? row.level,
      reqLevel: q?.reqLevel ?? row.reqlevel,
      side: q?.side ?? SIDES[row.side] ?? 'Both',
      // Records fetched before the parser learned to drop description boilerplate.
      summary: q?.summary && !/^A level/.test(q.summary) ? q.summary : undefined,
      type: q?.type,
      classes: siteIds(q?.classes, questIds.classes),
      races: siteIds(q?.races, questIds.races),
      start: q ? giverOut(q, 'start', zoneId) : undefined,
      end: q ? giverOut(q, 'end', zoneId) : undefined,
      chain,
      rewards: {
        xp: rewards.xp,
        money: rewards.money || undefined,
        choices: rewards.choices.filter(([i]) => items[i]),
        items: rewards.items.filter(([i]) => items[i]),
        rep: rewards.rep,
      },
    });
  };
  for (const row of rows) await add(row.id, row);
  for (const id of extraIds) await add(id);
  quests.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  return { quests, chains, items };
}

/** Boss pins for dungeons on a fitted, checked map (see scripts/fit-dungeon-maps.mjs). */
async function loadBossMaps() {
  const fitsFile = path.join(root, 'scripts', 'dungeon-maps.json');
  const spawnsFile = raw('cmangos', 'dungeon-spawns.json');
  if (!(await fileExists(fitsFile)) || !(await fileExists(spawnsFile))) {
    console.log('boss pins: no dungeon-maps.json or cmangos spawns; skipping (run data:fetch --only=cmangos)');
    return () => undefined;
  }
  const fits = JSON.parse(await readText(fitsFile));
  const spawns = JSON.parse(await readText(spawnsFile));
  return (d, bosses) => {
    const map = DUNGEONS.find((x) => x.id === d.id)?.map;
    if (!PINNED_MAPS.includes(map) || !fits[map]) return undefined;
    return { bosses: bossPins(bosses, spawns, map, fits[map], BOSS_SPAWNS), mapCrop: fits[map].crop };
  };
}

/** Writes quest bundles for `zoneList` (zones and cities), each class, and dungeons and raids. */
async function buildQuests(zoneList, dungeons) {
  continentOf = new Map(zoneList.map((z) => [z.id, z.continent]));
  const records = await loadQuestRecords();
  if (!records.size) {
    console.log('quests: no quest records in data-raw/wowhead/quests; skipping (run data:fetch --only=quests)');
    return;
  }
  const chrClasses = parseCsv(await readText(raw('wago', 'ChrClasses.csv')));
  questIds = {
    classes: new Map(chrClasses.map((r) => [Number(r.ID), r.Name_lang.toLowerCase()])),
    races: new Map(RACES.map((r) => [r.clientId, r.id])),
  };
  // Class and race quests: Wowhead files class quests under the class, so each joins the
  // zone it starts in, and every class gets a bundle of its own quests for level events.
  const restricted = [...records.values()].filter(
    (q) => q.level > 0 && (q.classes?.length || q.races?.length) && !NOT_A_QUEST.test(q.name),
  );
  for (const zone of zoneList) {
    const startsHere = restricted.filter((q) => startZones(q).includes(zone.id)).map((q) => q.id);
    const rows = await zoneQuestRows(zone.id);
    let bundle = await questBundle(rows, records, zone.id, startsHere);
    // Chain steps that start here but that Wowhead files elsewhere (an item drop's quest,
    // say) would only get a one-line summary naming this zone; bring them in.
    const have = new Set(bundle.quests.map((q) => q.id));
    const chainSteps = Object.values(bundle.chains)
      .flat(2)
      .map((s) => s.id)
      .filter((id) => {
        const r = records.get(id);
        return !have.has(id) && r?.level > 0 && !NOT_A_QUEST.test(r.name) && startZones(r).includes(zone.id);
      });
    if (chainSteps.length) bundle = await questBundle(rows, records, zone.id, [...startsHere, ...chainSteps]);
    await writeJson(`quests/zone-${zone.id}.json`, { mapZone: zone.id, ...bundle });
  }
  // A class quest is filed under a class, or limited to one or two classes (Forever's new ones
  // file under their zone). Profession and armor quests list more classes and don't count.
  const classCategory = await classCategoryQuestIds();
  const isClassQuest = (q) => classCategory.has(q.id) || q.classes?.length <= 2;
  for (const [clientId, classId] of questIds.classes) {
    if (!CLASSES.includes(classId)) continue;
    const ids = restricted
      .filter((q) => q.classes?.includes(clientId) && isClassQuest(q) && !NOT_A_QUEST.test(q.name))
      .map((q) => q.id);
    const bundle = await questBundle([], records, undefined, ids);
    await writeJson(`quests/class-${classId}.json`, bundle);
    console.log(`class quests ${classId}: ${bundle.quests.length}`);
  }
  const pinsFor = await loadBossMaps();
  for (const d of [...dungeons, ...RAIDS]) {
    const zoneIds = INSTANCE_ZONES[d.id] ?? [];
    const rows = (await Promise.all(zoneIds.map(zoneQuestRows))).flat();
    // Attunement and key chains, from the quest that completes each one.
    const attunements = [];
    for (const a of ATTUNEMENTS[d.id] ?? []) {
      const last = records.get(a.quest);
      if (!last) {
        console.warn(`attunement ${d.id}: quest ${a.quest} not in Forever data, skipped`);
        continue;
      }
      const steps = last.series ? last.series.map((s) => s.map((x) => x.id)) : [[a.quest]];
      attunements.push({ title: a.title, faction: a.faction, optional: a.optional, quests: steps });
    }
    const bundle = await questBundle(rows, records, zoneIds[0], attunements.flatMap((a) => a.quests.flat()));
    const pinned = d.bosses ? pinsFor(d, d.bosses) : undefined;
    if (pinned) {
      const n = pinned.bosses.filter((b) => b.pins.length).length;
      console.log(`boss pins ${d.id}: ${n}/${pinned.bosses.length} bosses`);
    }
    await writeJson(`quests/dungeon-${d.id}.json`, { mapZone: zoneIds[0], ...bundle, attunements, ...pinned });
  }
  const sizes = { quests: records.size, items: [...itemTips.values()].filter(Boolean).length };
  console.log(`quests: ${sizes.quests} quest records, ${sizes.items} item tooltips`);
}

// ---------------------------------------------------------------- main

await rm(outDir, { recursive: true, force: true });
const classMeta = [];
for (const c of CLASSES) classMeta.push(await buildClass(c));
const races = await buildRaces(classMeta);
const professions = [];
for (const p of PROFESSIONS) professions.push(await buildProfession(p));
const dungeons = await buildInstances();
const zoneList = await buildZones(races);
const cityList = await buildCities();
await buildQuests([...zoneList, ...cityList], dungeons);
await writeJson('meta.json', {
  clientBuild: WAGO_BUILD,
  generatedAt: new Date().toISOString().slice(0, 10),
  classes: classMeta,
  races,
  professions,
  professionRanks: PROFESSION_RANKS,
  milestones: MILESTONES,
});
console.log('wrote', path.relative(root, outDir));
