// Turns the raw downloads in data-raw/ (see fetch-sources.mjs) into the JSON
// the site loads from src/data/generated/.

import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';
import { WAGO_BUILD, CLASSES, PROFESSIONS } from './sources.mjs';
import {
  SPECS,
  RACES,
  DUNGEONS,
  RAIDS,
  BATTLEGROUNDS,
  PROFESSION_RANKS,
  MILESTONES,
  ZONE_OVERRIDES,
} from './curated.mjs';
import { extractJsonScript, listviews } from './lib/wowhead.mjs';
import { parseCsv } from './lib/csv.mjs';

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
      bosses: detail.querySelectorAll('.idt-boss').map((b) => text(b)),
    });
  }
  const dungeons = DUNGEONS.map((d) => {
    const c = client.get(d.client);
    if (!c) throw new Error(`dungeon ${d.id}: no client row "${d.client}"`);
    const bosses = d.bosses ? c.bosses.filter((b) => d.bosses.includes(b)) : c.bosses;
    const { client: _slug, bosses: _wing, ...rest } = d;
    return {
      ...rest,
      entryLevel: c.entryLevel,
      players: c.players ?? 5,
      changed: !d.isNew && c.changed ? true : undefined,
      bosses,
      // Announced dungeons missing from this client build have no boss list yet.
      inClient: c.bosses.length > 0,
    };
  });
  await writeJson('instances.json', { dungeons, raids: RAIDS, battlegrounds: BATTLEGROUNDS });
  console.log(`instances: ${dungeons.length} dungeons`);
}

// ---------------------------------------------------------------- zones

const CONTINENTS = { 0: 'Eastern Kingdoms', 1: 'Kalimdor', [-1]: 'Skywall' };
const TERRITORY = { 0: 'Alliance', 1: 'Horde', 2: 'Contested', 3: 'Sanctuary' };
// A zone counts as a leveling zone for a faction with at least this many quests
// it can take; in the other faction's territory they must be its own quests.
const MIN_QUESTS = 10;
const MIN_OWN_QUESTS_IN_ENEMY_TERRITORY = 6;
// Placeholder rows (<NYI>, <UNUSED>), Legacy reward pickups and similar aren't leveling quests.
const NOT_A_QUEST = /^<|^Legacy Reward/;

function percentile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)))];
}

async function buildZones(races) {
  const list = JSON.parse(extractJsonScript(await readText(raw('wowhead', 'zones.html')), 'data.page.listPage.listviews'))[0]
    .data;
  const byId = new Map(list.map((z) => [z.id, z]));
  const files = (await readdir(raw('wowhead'))).filter((f) => /^zone-\d+\.html$/.test(f));
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
}

// ---------------------------------------------------------------- main

await rm(outDir, { recursive: true, force: true });
const classMeta = [];
for (const c of CLASSES) classMeta.push(await buildClass(c));
const races = await buildRaces(classMeta);
const professions = [];
for (const p of PROFESSIONS) professions.push(await buildProfession(p));
await buildInstances();
await buildZones(races);
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
