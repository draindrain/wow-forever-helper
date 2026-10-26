import type {
  ClassData,
  DoneQuest,
  Dungeon,
  Faction,
  FactionRange,
  GatherNode,
  ProfessionRank,
  Quest,
  QuestBundle,
  Race,
  Recipe,
  Spec,
  Spell,
  SpellRank,
  Zone,
} from '../types';

// ---------------------------------------------------------------- difficulty colours

export type Difficulty = 'red' | 'orange' | 'yellow' | 'green' | 'grey';

/** Highest level that still gives you XP is greyLevel + 1 (Classic formula). */
export function greyLevel(level: number): number {
  if (level <= 5) return 0;
  if (level <= 39) return level - 5 - Math.floor(level / 10);
  if (level <= 59) return level - 1 - Math.floor(level / 5);
  return level - 9;
}

/** Quest/mob colour as the game shows it for a target `level` seen by a player at `player`. */
export function levelColor(level: number, player: number): Difficulty {
  const diff = level - player;
  if (diff >= 5) return 'red';
  if (diff >= 3) return 'orange';
  if (diff >= -2) return 'yellow';
  if (level > greyLevel(player)) return 'green';
  return 'grey';
}

// ---------------------------------------------------------------- spells

/** Spells this race and faction can learn at all. */
export function learnableSpells(data: ClassData, race: Race, faction: Faction): Spell[] {
  return data.spells.filter(
    (s) =>
      (!s.faction || s.faction === faction) && (s.races.length === 0 || s.races.some((r) => race.name.includes(r))),
  );
}

export type TalentState = 'none' | 'spec' | 'other';

/** Whether a spell's later ranks depend on a talent, and whether that talent is in your spec's tree. */
export function talentState(spell: Spell, spec: Spec): TalentState {
  if (!spell.talent) return 'none';
  return spell.talent.tree === spec.school ? 'spec' : 'other';
}

export interface RankEntry {
  spell: Spell;
  rank: SpellRank;
  /** First time this spell can be learned at all (vs. an upgrade rank). */
  isNewSpell: boolean;
}

/** Spell ranks the trainer teaches at exactly `level`. */
export function ranksAt(spells: Spell[], level: number): RankEntry[] {
  const out: RankEntry[] = [];
  for (const spell of spells) {
    spell.ranks.forEach((rank, i) => {
      if (rank.level === level) out.push({ spell, rank, isNewSpell: i === 0 && !spell.talent });
    });
  }
  return out;
}

export interface SpellbookEntry {
  spell: Spell;
  /** Highest rank you can have at this level (undefined if none yet). */
  current?: SpellRank;
  next?: SpellRank;
}

/** Every spell with the rank you have at `level` and the next one, including spells you can't learn yet. */
export function spellbook(spells: Spell[], level: number): SpellbookEntry[] {
  return spells.map((spell) => ({
    spell,
    current: [...spell.ranks].reverse().find((r) => r.level <= level),
    next: spell.ranks.find((r) => r.level > level),
  }));
}

/** Spec-tree talents with an active spell (e.g. Mortal Strike), by the level you can take them. */
export function specTalentSpells(spells: Spell[], spec: Spec): { spell: Spell; level: number }[] {
  return spells
    .filter((s) => s.talent && s.talent.tree === spec.school)
    .map((s) => ({ spell: s, level: s.talent!.level }));
}

// ---------------------------------------------------------------- zones

export type ZoneFit = 'ideal' | 'early' | 'late' | 'other' | 'upcoming';

export interface ZoneSuggestion {
  zone: Zone;
  min: number;
  max: number;
  fit: ZoneFit;
  /** Quests at a good level for you right now (yellow or orange). */
  goodQuests: number;
  /** Green quests: still XP, quick to do. */
  greenQuests: number;
  totalQuests: number;
  estimated: boolean;
  isStart: boolean;
}

export function zoneCanVisit(zone: Zone, race: Race): boolean {
  return !zone.races || zone.races.includes(race.id);
}

/** A zone's quest counts by level, less the quests marked done there. */
function questsLeft(range: FactionRange, zoneId: number, done: Record<string, DoneQuest> = {}) {
  const histogram = { ...range.histogram };
  let quests = range.quests;
  for (const q of Object.values(done)) {
    // The counts leave out some quests the zone's list shows, so never go below none.
    if (q.zone !== zoneId || !histogram[q.level]) continue;
    histogram[q.level]!--;
    quests--;
  }
  return { histogram, quests };
}

export function suggestZones(
  zones: Zone[],
  race: Race,
  level: number,
  done?: Record<string, DoneQuest>,
): ZoneSuggestion[] {
  const out: ZoneSuggestion[] = [];
  for (const zone of zones) {
    const range = zone.factions[race.faction];
    if (!range || !zoneCanVisit(zone, race)) continue;
    const left = questsLeft(range, zone.id, done);
    let goodQuests = 0;
    let greenQuests = 0;
    for (const [lvl, count] of Object.entries(left.histogram)) {
      const color = levelColor(Number(lvl), level);
      if (color === 'yellow' || color === 'orange') goodQuests += count;
      else if (color === 'green') greenQuests += count;
    }
    const fit: ZoneFit =
      level >= range.min && level <= range.max
        ? 'ideal'
        : level < range.min && level >= range.min - 3
          ? 'early'
          : level > range.max && level <= range.max + 2
            ? 'late'
            : 'other';
    if (fit === 'other' && goodQuests < 8) continue;
    out.push({
      zone,
      min: range.min,
      max: range.max,
      fit,
      goodQuests,
      greenQuests,
      totalQuests: left.quests,
      estimated: !!range.estimated,
      isStart: zone.id === race.startZone,
    });
  }
  const fitOrder: Record<ZoneFit, number> = { ideal: 0, late: 1, early: 2, other: 3, upcoming: 4 };
  return out.sort((a, b) => fitOrder[a.fit] - fitOrder[b.fit] || b.goodQuests - a.goodQuests || a.min - b.min);
}

/** Zones you'll reach within `ahead` levels that aren't suggested yet, nearest first. */
export function upcomingZones(
  zones: Zone[],
  race: Race,
  level: number,
  done?: Record<string, DoneQuest>,
  ahead = 10,
): ZoneSuggestion[] {
  const suggested = new Set(suggestZones(zones, race, level, done).map((s) => s.zone.id));
  const out: ZoneSuggestion[] = [];
  for (const zone of zones) {
    const range = zone.factions[race.faction];
    if (!range || suggested.has(zone.id) || !zoneCanVisit(zone, race)) continue;
    if (range.min <= level || range.min > level + ahead) continue;
    out.push({
      zone,
      min: range.min,
      max: range.max,
      fit: 'upcoming',
      goodQuests: 0,
      greenQuests: 0,
      totalQuests: questsLeft(range, zone.id, done).quests,
      estimated: !!range.estimated,
      isStart: false,
    });
  }
  return out.sort((a, b) => a.min - b.min || a.max - b.max);
}

export interface CitySuggestion {
  city: Zone;
  /** Quests that still give you XP and aren't far above you (orange, yellow or green). */
  quests: number;
}

/** Your faction's capital cities, the ones with the most quests at your level first. */
export function cityQuests(
  cities: Zone[],
  race: Race,
  level: number,
  done?: Record<string, DoneQuest>,
): CitySuggestion[] {
  const out: CitySuggestion[] = [];
  for (const city of cities) {
    const range = city.factions[race.faction];
    if (!range || !zoneCanVisit(city, race)) continue;
    let quests = 0;
    for (const [lvl, count] of Object.entries(questsLeft(range, city.id, done).histogram)) {
      const color = levelColor(Number(lvl), level);
      if (color === 'orange' || color === 'yellow' || color === 'green') quests += count;
    }
    out.push({ city, quests });
  }
  return out.sort((a, b) => b.quests - a.quests || a.city.name.localeCompare(b.city.name));
}

// ---------------------------------------------------------------- dungeons

export type DungeonFit = 'locked' | 'hard' | 'ideal' | 'easy' | 'grey';

export function dungeonFit(d: Dungeon, level: number): DungeonFit {
  if (d.entryLevel && level < d.entryLevel) return 'locked';
  if (level < d.min) return 'hard';
  if (level <= d.max) return 'ideal';
  if (level <= d.max + 3) return 'easy';
  return 'grey';
}

export function dungeonsFor(dungeons: Dungeon[], faction: Faction, level: number): Dungeon[] {
  return dungeons.filter((d) => (!d.faction || d.faction === faction) && level >= d.min - 3 && level <= d.max + 3);
}

// ---------------------------------------------------------------- professions

export interface RankStatus {
  current: ProfessionRank;
  next?: ProfessionRank;
  /** You meet the next rank's skill and level requirements. */
  canTrainNext: boolean;
  capped: boolean;
}

export function rankStatus(ranks: ProfessionRank[], skill: number, level: number): RankStatus {
  // At exactly a rank's cap (75, 150, ...) you're still in that rank until you train the next.
  const found = ranks.findIndex((r) => skill <= r.maxSkill);
  const index = found === -1 ? ranks.length - 1 : found;
  const current = ranks[index]!;
  const next = ranks[index + 1];
  return {
    current,
    next,
    canTrainNext: !!next && skill >= next.minSkill && level >= next.level,
    capped: skill >= current.maxSkill,
  };
}

export type RecipeColor = 'orange' | 'yellow' | 'green' | 'grey';

export function recipeColor(r: Recipe, skill: number): RecipeColor {
  if (r.grey !== undefined && skill >= r.grey) return 'grey';
  if (r.green !== undefined && skill >= r.green) return 'green';
  if (r.yellow !== undefined && skill >= r.yellow) return 'yellow';
  return 'orange';
}

/**
 * Skill at which you can (probably) learn a recipe. Recipe items state it; for
 * trainer recipes the requirement lives on the server, so we assume the trainer
 * offers it from about 10 points below where it turns yellow.
 */
export function learnSkill(r: Recipe): { skill: number; known: boolean } {
  if (r.learn !== undefined) return { skill: r.learn, known: true };
  return { skill: Math.max(1, (r.yellow ?? 1) - 10), known: false };
}

export function skillUpRecipes(recipes: Recipe[], skill: number): Recipe[] {
  const order: Record<RecipeColor, number> = { orange: 0, yellow: 1, green: 2, grey: 3 };
  return recipes
    .filter((r) => learnSkill(r).skill <= skill && recipeColor(r, skill) !== 'grey')
    .sort(
      (a, b) =>
        order[recipeColor(a, skill)] - order[recipeColor(b, skill)] ||
        // Trainer recipes first: recipe items have to be found or bought.
        Number(a.source === 'item') - Number(b.source === 'item') ||
        (b.yellow ?? 0) - (a.yellow ?? 0),
    );
}

export function upcomingRecipes(recipes: Recipe[], skill: number): Recipe[] {
  return recipes.filter((r) => learnSkill(r).skill > skill).sort((a, b) => learnSkill(a).skill - learnSkill(b).skill);
}

/** Every herb or ore in the zone data, with the lowest skill any zone lists for it. */
export function allNodes(zones: Zone[], kind: GatherNode['kind']): GatherNode[] {
  const nodes = new Map<string, GatherNode>();
  for (const z of zones) {
    for (const n of z.nodes) {
      if (n.kind !== kind) continue;
      const prev = nodes.get(n.name);
      if (!prev || prev.skill > n.skill) nodes.set(n.name, n);
    }
  }
  return [...nodes.values()].sort((a, b) => a.skill - b.skill || a.name.localeCompare(b.name));
}

/**
 * Highest level beast you can skin. The Forever client's skill text gives skill/5
 * past 100; below 100 this uses the Classic rule of skill/10 + 10.
 */
export function maxSkinLevel(skill: number): number {
  return skill >= 100 ? Math.floor(skill / 5) : Math.floor(skill / 10) + 10;
}

export function skillToSkin(level: number): number {
  return level <= 20 ? Math.max(1, (level - 10) * 10) : level * 5;
}

// ---------------------------------------------------------------- quests

/** Whether this character can take a quest: their faction's (or both) and, for class or race quests, theirs. */
export function canTakeQuest(q: Quest, race: Race, classId: string): boolean {
  return (
    (q.side === 'Both' || q.side === race.faction) &&
    (!q.classes || q.classes.includes(classId)) &&
    (!q.races || q.races.includes(race.id))
  );
}

/** The level a quest can first be picked up at. */
export const questUnlockLevel = (q: Quest) => q.reqLevel ?? q.level;

/**
 * The class quests this character can start, by the level they unlock: one per chain (its
 * first step they can take and haven't done) and one per name and level, since Wowhead keeps
 * a copy of a quest for each trainer that gives it (the one in your starting zone wins).
 */
export function classQuestStarts(
  bundle: QuestBundle,
  race: Race,
  classId: string,
  done: Record<string, DoneQuest> = {},
): Quest[] {
  const mine = bundle.quests.filter(
    (q) => q.classes?.includes(classId) && canTakeQuest(q, race, classId) && !(String(q.id) in done),
  );
  const firstStep = new Map<string, number>();
  for (const q of mine) {
    if (q.chain) firstStep.set(q.chain.id, Math.min(firstStep.get(q.chain.id) ?? Infinity, q.chain.step));
  }
  const byName = new Map<string, Quest>();
  for (const q of mine) {
    if (q.chain && q.chain.step !== firstStep.get(q.chain.id)) continue;
    const key = `${q.name} ${questUnlockLevel(q)}`;
    const kept = byName.get(key);
    if (!kept || (kept.start?.zone !== race.startZone && q.start?.zone === race.startZone)) byName.set(key, q);
  }
  return [...byName.values()].sort(
    (a, b) => questUnlockLevel(a) - questUnlockLevel(b) || a.level - b.level || a.name.localeCompare(b.name),
  );
}
