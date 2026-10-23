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
}
