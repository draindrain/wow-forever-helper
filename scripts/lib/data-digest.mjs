// Snapshots src/data/generated/ and describes what changed between two snapshots:
// spells, racials, recipes, zones, dungeons, raids, quests and milestones.

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

async function jsonFiles(dir) {
  try {
    return (await readdir(dir)).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
}

const range = (r) => (r ? `${r.min}-${r.max}` : '-');

/** Every record the site shows, keyed so two snapshots can be compared field by field. */
export async function snapshot(generatedDir) {
  const snap = {
    clientBuild: null,
    spells: {},
    racials: {},
    recipes: {},
    zones: {},
    dungeons: {},
    raids: {},
    quests: {},
    milestones: {},
    professionRanks: {},
  };
  const meta = await readJson(path.join(generatedDir, 'meta.json'));
  if (meta) {
    snap.clientBuild = meta.clientBuild;
    for (const race of meta.races)
      for (const r of race.racials) snap.racials[`${race.name}: ${r.name}`] = { desc: r.desc, meta: r.meta ?? '' };
    for (const m of meta.milestones)
      snap.milestones[m.title] = { level: m.level, text: m.text, confirmed: m.confirmed };
    for (const r of meta.professionRanks)
      snap.professionRanks[r.name] = {
        level: r.level,
        maxSkill: r.maxSkill,
        minSkill: r.minSkill,
        confirmed: r.confirmed,
      };
  }
  for (const file of await jsonFiles(path.join(generatedDir, 'classes'))) {
    const c = await readJson(path.join(generatedDir, 'classes', file));
    for (const s of c.spells)
      snap.spells[`${c.name}: ${s.name}`] = {
        ranks: s.ranks.map((r) => `${r.rank ?? 'rank'}@${r.level}`).join(', '),
        status: s.status,
        talent: s.talent ? `${s.talent.tree}@${s.talent.level}` : '',
      };
  }
  for (const file of await jsonFiles(path.join(generatedDir, 'professions'))) {
    const prof = file.replace('.json', '');
    for (const r of (await readJson(path.join(generatedDir, 'professions', file))) ?? [])
      snap.recipes[`${prof}: ${r.name} (#${r.id})`] = {
        skill: `${r.learn ?? '?'}/${r.yellow ?? '?'}/${r.green ?? '?'}/${r.grey ?? '?'}`,
        reagents: r.reagents.map((x) => `${x.count}x ${x.name}`).join(', '),
        source: r.source,
      };
  }
  for (const z of (await readJson(path.join(generatedDir, 'zones.json'))) ?? [])
    snap.zones[z.name] = {
      alliance: range(z.factions.Alliance),
      horde: range(z.factions.Horde),
      nodes: z.nodes.map((n) => n.name).join(', '),
      note: z.note ?? '',
    };
  const inst = await readJson(path.join(generatedDir, 'instances.json'));
  for (const d of inst?.dungeons ?? [])
    snap.dungeons[d.name] = {
      levels: `${d.min}-${d.max}`,
      entry: d.entryLevel ?? '',
      players: d.players,
      bosses: d.bosses.join(', '),
    };
  for (const r of inst?.raids ?? []) snap.raids[r.name] = { zone: r.zone, size: r.size, isNew: !!r.isNew };
  for (const file of await jsonFiles(path.join(generatedDir, 'quests'))) {
    const bundle = await readJson(path.join(generatedDir, 'quests', file));
    const where = file.replace('.json', '');
    for (const q of bundle?.quests ?? [])
      snap.quests[`${q.name} (#${q.id})`] ??= { level: q.level, side: q.side, where };
  }
  return snap;
}

const CATEGORIES = [
  ['spells', 'Class spells'],
  ['racials', 'Racials'],
  ['recipes', 'Recipes'],
  ['zones', 'Zones'],
  ['dungeons', 'Dungeons'],
  ['raids', 'Raids'],
  ['quests', 'Quests'],
  ['milestones', 'Milestones'],
  ['professionRanks', 'Profession ranks'],
];

/** Added, removed and changed records per category. */
export function diff(before, after) {
  const out = {
    clientBuild: before.clientBuild !== after.clientBuild ? [before.clientBuild, after.clientBuild] : null,
  };
  for (const [key] of CATEGORIES) {
    const a = before[key];
    const b = after[key];
    const added = Object.keys(b).filter((k) => !(k in a));
    const removed = Object.keys(a).filter((k) => !(k in b));
    const changed = [];
    for (const k of Object.keys(b)) {
      if (!(k in a)) continue;
      const fields = Object.keys(b[k]).filter((f) => JSON.stringify(a[k][f]) !== JSON.stringify(b[k][f]));
      if (fields.length)
        changed.push({ key: k, fields: fields.map((f) => ({ field: f, from: a[k][f], to: b[k][f] })) });
    }
    out[key] = { added, removed, changed };
  }
  return out;
}

export function isEmpty(d) {
  return (
    !d.clientBuild &&
    CATEGORIES.every(([key]) => !d[key].added.length && !d[key].removed.length && !d[key].changed.length)
  );
}

/**
 * Markdown for people and the agent. Long lists are cut at `limit` entries with an
 * explicit "and N more"; the full lists are in the JSON digest written next to it.
 */
export function toMarkdown(d, limit = 60) {
  const lines = [];
  if (d.clientBuild) lines.push(`- **Client build:** ${d.clientBuild[0]} -> ${d.clientBuild[1]}`);
  const list = (items, fmt = (x) => x) => {
    const shown = items.slice(0, limit).map(fmt);
    if (items.length > limit) shown.push(`...and ${items.length - limit} more (see update-digest.json)`);
    return shown.map((s) => `  - ${s}`);
  };
  for (const [key, title] of CATEGORIES) {
    const { added, removed, changed } = d[key];
    if (!added.length && !removed.length && !changed.length) continue;
    lines.push(`\n### ${title}`);
    if (added.length) lines.push(`- Added (${added.length}):`, ...list(added));
    if (removed.length) lines.push(`- Removed (${removed.length}):`, ...list(removed));
    if (changed.length)
      lines.push(
        `- Changed (${changed.length}):`,
        ...list(changed, (c) => `${c.key}: ${c.fields.map((f) => `${f.field} "${f.from}" -> "${f.to}"`).join('; ')}`),
      );
  }
  return lines.length ? lines.join('\n') : 'No changes to the generated data.';
}
