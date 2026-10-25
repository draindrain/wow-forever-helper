import { createContext, useContext } from 'react';

export type ModalTarget =
  { kind: 'zone'; id: number } | { kind: 'dungeon'; id: string } | { kind: 'classQuest'; id: number } | null;

export interface ModalApi {
  openZone: (zoneId: number) => void;
  openDungeon: (dungeonId: string) => void;
  /** A class quest (and its chain), by quest id. */
  openClassQuest: (questId: number) => void;
}

export const ModalContext = createContext<ModalApi>({
  openZone: () => {},
  openDungeon: () => {},
  openClassQuest: () => {},
});

export const useModal = () => useContext(ModalContext);

/** Props that make any element open a modal on click or Enter/Space, like a button; `hint` shows on hover. */
export function clickable(onOpen: () => void, hint: string) {
  return {
    role: 'button',
    tabIndex: 0,
    'aria-haspopup': 'dialog',
    title: hint,
    onClick: onOpen,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onOpen();
      }
    },
  } as const;
}
