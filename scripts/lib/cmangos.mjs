// Reads creature spawns out of a CMaNGOS world database dump (.sql.gz).

import { createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import readline from 'node:readline';

/** Splits the "(a,'b',c),(d,...)" part of an INSERT into rows of raw values. */
function insertRows(line) {
  const values = line.slice(line.indexOf(' VALUES ') + 8);
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let depth = 0;
  for (let i = 0; i < values.length; i++) {
    const c = values[i];
    if (quoted) {
      if (c === '\\') field += values[++i];
      else if (c === "'") quoted = false;
      else field += c;
    } else if (c === "'") quoted = true;
    else if (c === '(') {
      if (++depth === 1) (row = []), (field = '');
      else field += c;
    } else if (c === ')') {
      if (--depth === 0) row.push(field), rows.push(row);
      else field += c;
    } else if (c === ',' && depth === 1) row.push(field), (field = '');
    else if (depth >= 1) field += c;
  }
  return rows;
}

/**
 * Creature spawns on the given maps: { spawns: [{ id, map, x, y, z }], names: { id: name } }.
 * A spawn whose creature is picked at random (id 0) is listed once per creature it can be.
 */
export async function dungeonSpawns(dumpFile, mapIds) {
  const maps = new Set(mapIds);
  const raw = [];
  const names = {};
  const spawnEntries = {};
  const groupOf = {};
  const groupEntries = {};
  const lines = readline.createInterface({ input: createReadStream(dumpFile).pipe(createGunzip()), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.startsWith('INSERT INTO `')) continue;
    const table = line.slice(13, line.indexOf('`', 13));
    if (table === 'creature') {
      for (const r of insertRows(line)) {
        if (maps.has(Number(r[2]))) raw.push({ guid: r[0], id: Number(r[1]), map: Number(r[2]), x: +r[4], y: +r[5], z: +r[6] });
      }
    } else if (table === 'creature_template') {
      for (const r of insertRows(line)) names[r[0]] = r[1];
    } else if (table === 'creature_spawn_entry') {
      for (const r of insertRows(line)) (spawnEntries[r[0]] ??= []).push(Number(r[1]));
    } else if (table === 'spawn_group_spawn') {
      for (const r of insertRows(line)) groupOf[r[1]] = r[0];
    } else if (table === 'spawn_group_entry') {
      for (const r of insertRows(line)) (groupEntries[r[0]] ??= []).push(Number(r[1]));
    }
  }
  const spawns = raw.flatMap(({ guid, ...s }) =>
    s.id ? [s] : (spawnEntries[guid] ?? groupEntries[groupOf[guid]] ?? []).map((id) => ({ ...s, id })),
  );
  const used = new Set(spawns.map((s) => s.id));
  return { spawns, names: Object.fromEntries(Object.entries(names).filter(([id]) => used.has(Number(id)))) };
}
