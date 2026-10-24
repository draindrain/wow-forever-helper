import type {
  Battleground,
  Character,
  ClassData,
  Dungeon,
  Equipment,
  Milestone,
  ProfessionMeta,
  ProfessionRank,
  Race,
  Spec,
  Spell,
} from '../types';
import { instances, meta, professionById } from '../data';
import { learnableSpells, ranksAt, specTalentSpells, talentState, type RankEntry } from './game';

export type LevelEvent =
  | { kind: 'spell'; entry: RankEntry }
  | { kind: 'talent'; spell: Spell }
  | { kind: 'equipment'; item: Equipment }
  | { kind: 'dungeon'; dungeon: Dungeon }
  | { kind: 'battleground'; bg: Battleground }
  | { kind: 'profession'; profession: ProfessionMeta; rank: ProfessionRank }
  | { kind: 'milestone'; milestone: Milestone };

export interface EventContext {
  character: Character;
  race: Race;
  spec: Spec;
  classData: ClassData;
}

/** Spells you can train: talent-gated ranks only count when the talent is in your spec's tree. */
function trainable(ctx: EventContext): Spell[] {
  return learnableSpells(ctx.classData, ctx.race, ctx.race.faction).filter((s) => talentState(s, ctx.spec) !== 'other');
}

export function eventsAt(ctx: EventContext, level: number): LevelEvent[] {
  const spells = trainable(ctx);
  const events: LevelEvent[] = [];

  for (const entry of ranksAt(spells, level)) events.push({ kind: 'spell', entry });
  for (const t of specTalentSpells(spells, ctx.spec)) {
    if (t.level === level) events.push({ kind: 'talent', spell: t.spell });
  }
  if (level > 1) {
    for (const item of ctx.classData.equipment) if (item.level === level) events.push({ kind: 'equipment', item });
  }
  for (const dungeon of instances.dungeons) {
    if (dungeon.min === level && (!dungeon.faction || dungeon.faction === ctx.race.faction)) {
      events.push({ kind: 'dungeon', dungeon });
    }
  }
  for (const bg of instances.battlegrounds) if (bg.min === level) events.push({ kind: 'battleground', bg });
  for (const p of ctx.character.professions) {
    const profession = professionById(p.id);
    if (!profession) continue;
    for (const rank of meta.professionRanks) {
      if (rank.level === level && rank.minSkill > 0) events.push({ kind: 'profession', profession, rank });
    }
  }
  for (const milestone of meta.milestones) {
    if (milestone.level === level) events.push({ kind: 'milestone', milestone });
  }
  return events;
}

/** The next level after `level` at which the trainer has something new for you. */
export function nextTrainingLevel(ctx: EventContext, level: number): number | undefined {
  let next: number | undefined;
  for (const s of trainable(ctx)) {
    for (const r of s.ranks) {
      if (r.level > level && (next === undefined || r.level < next)) next = r.level;
    }
  }
  return next;
}
