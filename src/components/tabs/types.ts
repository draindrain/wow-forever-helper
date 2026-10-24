import type { EventContext } from '../../lib/events';
import type { Character, ClassMeta, Race, Spec } from '../../types';

export type TabId = 'overview' | 'class' | 'quests' | 'trade';

export const TABS: { id: TabId; label: string; short: string }[] = [
  { id: 'overview', label: 'Overview', short: 'Overview' },
  { id: 'class', label: 'Class skills', short: 'Class' },
  { id: 'quests', label: 'Quests & dungeons', short: 'Quests' },
  { id: 'trade', label: 'Trade skills', short: 'Trade' },
];

export interface TabProps {
  /** Null while the class spellbook is loading. */
  ctx: EventContext | null;
  character: Character;
  race: Race;
  cls: ClassMeta;
  spec: Spec;
  onSkill: (professionId: string, skill: number) => void;
  onTab: (tab: TabId) => void;
}
