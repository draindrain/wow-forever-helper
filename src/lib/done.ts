import { createContext, useContext } from 'react';
import type { DoneQuest, Quest } from '../types';

export interface DoneApi {
  /** The active character's done quests, by quest id. */
  done: Record<string, DoneQuest>;
  /** Marks a quest done, or not done again; `zone` is the zone or city whose counts it belongs to. */
  toggle: (quest: Quest, zone?: number) => void;
}

export const DoneContext = createContext<DoneApi>({ done: {}, toggle: () => {} });

export const useDone = () => useContext(DoneContext);

export const isDone = (done: Record<string, DoneQuest>, questId: number) => String(questId) in done;
