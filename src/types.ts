// Shapes of the JSON in src/data/generated/ (written by scripts/build-data.mjs).

export type Faction = 'Alliance' | 'Horde';
export type ChangeStatus = 'new' | 'changed' | 'unchanged';

export interface SpellRank {
  rank?: string;
  level: number;
  meta?: string;
  desc: string;
}

export interface Spell {
  name: string;
  icon: string;
  school: string;
  status: ChangeStatus;
  passive?: boolean;
  /** Only these races can learn it (empty = everyone). */
  races: string[];
  faction?: Faction;
  note?: string;
  /** Inherited from Season of Discovery tables and not yet seen on the beta. */
  unconfirmed?: boolean;
  /** Rank 1 comes from a talent in this tree; the trainer teaches later ranks. */
  talent?: { tree: string; level: number };
  ranks: SpellRank[];
}

export interface Equipment {
  name: string;
  icon: string;
  level: number;
}

export interface ClassData {
  id: string;
  name: string;
  schools: string[];
  spells: Spell[];
  equipment: Equipment[];
}

export interface Spec {
  id: string;
  name: string;
  school: string;
  role: string;
}

export interface ClassMeta {
  id: string;
  name: string;
  specs: Spec[];
}

export interface Racial {
  name: string;
  icon: string;
  passive?: boolean;
  desc: string;
  meta?: string;
}

export interface Race {
  id: string;
  name: string;
  faction: Faction;
  classes: string[];
  newClasses: string[];
  startZone: number;
  icon: string;
  racials: Racial[];
}

export type ProfessionKind = 'crafting' | 'gathering' | 'secondary';

export interface ProfessionMeta {
  id: string;
  name: string;
  kind: ProfessionKind;
  recipes: number;
}

export interface ProfessionRank {
  name: string;
  maxSkill: number;
  minSkill: number;
  level: number;
  confirmed: boolean;
}

export interface Milestone {
  level: number;
  title: string;
  text: string;
  source: string;
  confirmed: boolean;
}

export interface Meta {
  clientBuild: string;
  generatedAt: string;
  classes: ClassMeta[];
  races: Race[];
  professions: ProfessionMeta[];
  professionRanks: ProfessionRank[];
  milestones: Milestone[];
}

export interface Recipe {
  id: number;
  name: string;
  icon: string;
  heading: string;
  status: ChangeStatus;
  source: 'trainer' | 'item';
  taughtBy?: string;
  /** Only this faction can learn it. */
  faction?: Faction;
  /** Skill needed to learn it, when the client states one (recipe items). */
  learn?: number;
  yellow?: number;
  green?: number;
  grey?: number;
  quality: number;
  reagents: { name: string; count: number }[];
  /** The crafted item's tooltip. */
  product?: ItemTip;
}

export interface FactionRange {
  min: number;
  max: number;
  quests: number;
  /** Quest level -> number of quests at that level. */
  histogram: Record<string, number>;
  /** Too few quests catalogued; the range comes from another source. */
  estimated?: boolean;
}

export interface GatherNode {
  name: string;
  kind: 'herb' | 'ore';
  skill: number;
}

export interface Zone {
  id: number;
  name: string;
  continent: string;
  territory: string;
  /** Only these races can reach it. */
  races?: string[];
  note?: string;
  isNew?: boolean;
  updated?: boolean;
  wowheadRange?: [number, number];
  factions: Partial<Record<Faction, FactionRange>>;
  nodes: GatherNode[];
}

export interface Dungeon {
  id: string;
  name: string;
  zone: string;
  min: number;
  max: number;
  isNew?: boolean;
  changed?: boolean;
  faction?: Faction;
  entryLevel?: number;
  players: number;
  bosses: string[];
  inClient: boolean;
}

export interface Raid {
  id: string;
  name: string;
  zone: string;
  size: number;
  isNew?: boolean;
}

export interface Battleground {
  id: string;
  name: string;
  min: number;
  size: string;
  isNew?: boolean;
}

export interface Instances {
  dungeons: Dungeon[];
  raids: Raid[];
  battlegrounds: Battleground[];
}

// ---- saved in the browser

export interface CharacterProfession {
  id: string;
  skill: number;
}

export interface Character {
  id: string;
  name: string;
  race: string;
  classId: string;
  spec: string;
  level: number;
  professions: CharacterProfession[];
  /** Quests marked done, by quest id. */
  done?: Record<string, DoneQuest>;
}

/** What a done quest needs for taking it off the zone counters without loading the zone's quests. */
export interface DoneQuest {
  level: number;
  /** The zone or city whose quest counts it was part of; none for class and instance quests. */
  zone?: number;
}

// ---- quests (src/data/generated/quests/*.json)

/** One line of an item tooltip: text, optional right-hand text, Wowhead colour class (q, q0-q5) or money. */
export interface TipLine {
  t: string;
  r?: string;
  c?: string;
  /** Copper, for "Sell Price:" lines. */
  money?: number;
}

export interface ItemTip {
  name: string;
  quality: number;
  icon?: string;
  lines: TipLine[];
}

export interface QuestGiver {
  name: string;
  kind: 'npc' | 'object' | 'item';
  /** Wowhead zone id and name of the giver's map, with x/y in percent of that map. */
  zone?: number;
  zoneName?: string;
  coord?: [number, number];
}

export interface QuestRewards {
  xp?: number;
  /** Copper. */
  money?: number;
  /** [itemId, count]: pick one. */
  choices: [number, number][];
  /** [itemId, count]: always given. */
  items: [number, number][];
  /** [faction, amount] */
  rep: [string, number][];
}

export interface Quest {
  id: number;
  name: string;
  level: number;
  reqLevel?: number;
  side: Faction | 'Both';
  /** The objective, e.g. "Bring 8 Gnoll Paws to Marshal Dughan." */
  summary?: string;
  type?: string;
  /** Only these classes / races (ids as in meta.json) can take it. */
  classes?: string[];
  races?: string[];
  start?: QuestGiver;
  end?: QuestGiver;
  chain?: { id: string; step: number; length: number };
  rewards: QuestRewards;
}

export interface ChainStep {
  id: number;
  name: string;
  level?: number;
  side?: string;
  /** Zone the step starts in. */
  zone?: string;
}

export interface Attunement {
  title: string;
  faction?: Faction;
  optional?: boolean;
  /** Quest ids, step by step (a step can offer alternatives). */
  quests: number[][];
}

/** A boss and where it spawns, in percent of the instance map image. */
export interface BossPins {
  name: string;
  pins: [number, number][];
  note?: string;
}

export interface QuestBundle {
  /** Wowhead zone id whose map image to show. */
  mapZone?: number;
  quests: Quest[];
  /** Chain id (its first quest's id) -> steps. */
  chains: Record<string, ChainStep[][]>;
  items: Record<string, ItemTip>;
  attunements?: Attunement[];
  /** Dungeons only, when its map has checked boss positions; same order as its boss list. */
  bosses?: BossPins[];
  /** The drawn part of the map image (x0, y0, x1, y1 in percent), to zoom to. */
  mapCrop?: [number, number, number, number];
}
