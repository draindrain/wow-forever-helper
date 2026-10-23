import metaJson from './generated/meta.json';
import zonesJson from './generated/zones.json';
import instancesJson from './generated/instances.json';
import type { ClassData, Instances, Meta, Recipe, Zone } from '../types';

export const meta = metaJson as Meta;
export const zones = zonesJson as Zone[];
export const instances = instancesJson as Instances;

// Class spellbooks and recipe lists are larger, so each loads on demand.
const classFiles = import.meta.glob<{ default: ClassData }>('./generated/classes/*.json');
const professionFiles = import.meta.glob<{ default: Recipe[] }>('./generated/professions/*.json');

export async function loadClass(classId: string): Promise<ClassData> {
  const load = classFiles[`./generated/classes/${classId}.json`];
  if (!load) throw new Error(`Unknown class ${classId}`);
  return (await load()).default;
}

export async function loadRecipes(professionId: string): Promise<Recipe[]> {
  const load = professionFiles[`./generated/professions/${professionId}.json`];
  if (!load) throw new Error(`Unknown profession ${professionId}`);
  return (await load()).default;
}

export const raceById = (id: string) => meta.races.find((r) => r.id === id);
export const classById = (id: string) => meta.classes.find((c) => c.id === id);
export const professionById = (id: string) => meta.professions.find((p) => p.id === id);

export const iconUrl = (icon: string, size: 'small' | 'medium' | 'large' = 'medium') =>
  `https://wow.zamimg.com/images/wow/icons/${size}/${icon}.jpg`;

export const MAX_LEVEL = 60;
/** The beta stopped at 30; content past it is client data nobody has played yet. */
export const BETA_LEVEL_CAP = 30;
