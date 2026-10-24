// Boss positions on Wowhead's dungeon map images (772x515), from Classic creature spawns.

export const MAP_W = 772;
export const MAP_H = 515;

/**
 * World position -> percent of the map image, by a fit from scripts/fit-dungeon-maps.mjs:
 * uniform scale `k` (pixels per yard) around the world point (cx, cy) that sits at the
 * image's centre. World x points north and y west.
 */
export function toMap(fit, x, y) {
  return [((MAP_W / 2 - (y - fit.cy) * fit.k) / MAP_W) * 100, ((MAP_H / 2 - (x - fit.cx) * fit.k) / MAP_H) * 100];
}

/**
 * Pins for each boss: every spawn of its creature (or of the creature it appears with,
 * per `aliases`) on the map. Bosses that only appear through a script get none.
 */
export function bossPins(bosses, { spawns, names }, mapId, fit, aliases = {}) {
  const idsByName = {};
  for (const [id, name] of Object.entries(names)) (idsByName[name] ??= []).push(Number(id));
  return bosses.map((name) => {
    const alias = aliases[name];
    const ids = new Set(idsByName[alias?.npc ?? name] ?? []);
    const pins = spawns
      .filter((s) => s.map === mapId && ids.has(s.id))
      .map((s) => toMap(fit, s.x, s.y).map((v) => Math.round(v * 10) / 10))
      .filter(([x, y]) => x >= 0 && x <= 100 && y >= 0 && y <= 100);
    return { name, pins, note: alias?.note };
  });
}
