import metaJson from './generated/meta.json';
import zonesJson from './generated/zones.json';
import instancesJson from './generated/instances.json';
import type { ClassData, Instances, Meta, QuestBundle, Recipe, Zone } from '../types';

export const meta = metaJson as Meta;
export const zones = zonesJson as Zone[];
export const instances = instancesJson as Instances;

// Class spellbooks and recipe lists are larger, so each loads on demand.
type Loader<T> = () => Promise<{ default: T }>;

const RELOAD_KEY = 'wow-forever-helper:reloaded-at';

/**
 * Runs a data chunk import. The page often stays open for hours on a second screen, and a
 * deploy in the meantime replaces the hashed chunk files it points at, so a failed import
 * reloads the page once to pick up the new build (not again within a minute, so a real
 * outage can't loop).
 */
async function importChunk<T>(load: Loader<T>): Promise<T> {
  try {
    return (await load()).default;
  } catch (error) {
    try {
      const last = Number(sessionStorage.getItem(RELOAD_KEY));
      if (!(Date.now() - last < 60_000)) {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        location.reload();
      }
    } catch {
      // No session storage: just report the error.
    }
    throw error;
  }
}

const classFiles = import.meta.glob<{ default: ClassData }>('./generated/classes/*.json');
const professionFiles = import.meta.glob<{ default: Recipe[] }>('./generated/professions/*.json');

export async function loadClass(classId: string): Promise<ClassData> {
  const load = classFiles[`./generated/classes/${classId}.json`];
  if (!load) throw new Error(`Unknown class ${classId}`);
  return importChunk(load);
}

const questFiles = import.meta.glob<{ default: QuestBundle }>('./generated/quests/*.json');

/** Quests for a zone (by Wowhead zone id) or null if this build has none. */
export async function loadZoneQuests(zoneId: number): Promise<QuestBundle | null> {
  const load = questFiles[`./generated/quests/zone-${zoneId}.json`];
  return load ? importChunk(load) : null;
}

/** Quests and attunements for a dungeon or raid (by its id in instances.json). */
export async function loadDungeonQuests(dungeonId: string): Promise<QuestBundle | null> {
  const load = questFiles[`./generated/quests/dungeon-${dungeonId}.json`];
  return load ? importChunk(load) : null;
}

/** A class's own quests (Wowhead files them under the class, not a zone) or null if this build has none. */
export async function loadClassQuests(classId: string): Promise<QuestBundle | null> {
  const load = questFiles[`./generated/quests/class-${classId}.json`];
  return load ? importChunk(load) : null;
}

export const zoneById = (id: number) => zones.find((z) => z.id === id);

/** Forever map image for a Wowhead zone id (the coordinates in quest data are percentages of it). */
export const mapUrl = (zoneId: number) => `https://wow.zamimg.com/images/wow/classicplus/maps/enus/zoom/${zoneId}.jpg`;

export async function loadRecipes(professionId: string): Promise<Recipe[]> {
  const load = professionFiles[`./generated/professions/${professionId}.json`];
  if (!load) throw new Error(`Unknown profession ${professionId}`);
  return importChunk(load);
}

export const raceById = (id: string) => meta.races.find((r) => r.id === id);
export const classById = (id: string) => meta.classes.find((c) => c.id === id);
export const professionById = (id: string) => meta.professions.find((p) => p.id === id);

export const iconUrl = (icon: string, size: 'small' | 'medium' | 'large' = 'medium') =>
  `https://wow.zamimg.com/images/wow/icons/${size}/${icon}.jpg`;

export const MAX_LEVEL = 60;
/** The beta stopped at 30; content past it is client data nobody has played yet. */
export const BETA_LEVEL_CAP = 30;
