// Dungeon bosses from the client's DungeonEncounter table.

// Difficulty 0 and 1 are the normal five-player (and Classic raid) encounters; the
// client also carries Season of Discovery versions under other difficulties.
const NORMAL = new Set(['0', '1']);

/** Boss names for a client map id, in the client's order. */
export function encounterBosses(rows, mapId) {
  return rows
    .filter((r) => Number(r.MapID) === mapId && NORMAL.has(r.DifficultyID))
    .sort((a, b) => a.OrderIndex - b.OrderIndex)
    .map((r) => r.Name_lang);
}
