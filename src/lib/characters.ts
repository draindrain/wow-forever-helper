import { useCallback, useEffect, useState } from 'react';
import type { Character } from '../types';
import { MAX_LEVEL } from '../data';

const STORAGE_KEY = 'wow-forever-helper:characters';

interface Saved {
  version: 1;
  activeId: string | null;
  characters: Character[];
}

const empty: Saved = { version: 1, activeId: null, characters: [] };

function load(): Saved {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const saved = JSON.parse(raw) as Saved;
    return saved.version === 1 && Array.isArray(saved.characters) ? saved : empty;
  } catch {
    return empty;
  }
}

function save(state: Saved) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode or storage full: the session still works, it just won't persist.
  }
}

export const clampLevel = (level: number) => Math.min(MAX_LEVEL, Math.max(1, Math.round(level)));
export const clampSkill = (skill: number) => Math.min(300, Math.max(1, Math.round(skill)));

export function newCharacterId() {
  return Math.random().toString(36).slice(2, 10);
}

export function useCharacters() {
  const [state, setState] = useState<Saved>(load);

  useEffect(() => save(state), [state]);

  // Keep several open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setState(load());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const active = state.characters.find((c) => c.id === state.activeId) ?? state.characters[0] ?? null;

  const upsert = useCallback((character: Character) => {
    setState((s) => {
      const exists = s.characters.some((c) => c.id === character.id);
      return {
        ...s,
        activeId: character.id,
        // Keep what the form doesn't edit, such as done quests.
        characters: exists
          ? s.characters.map((c) => (c.id === character.id ? { ...c, ...character } : c))
          : [...s.characters, character],
      };
    });
  }, []);

  const update = useCallback((id: string, change: (c: Character) => Character) => {
    setState((s) => ({ ...s, characters: s.characters.map((c) => (c.id === id ? change(c) : c)) }));
  }, []);

  const remove = useCallback((id: string) => {
    setState((s) => {
      const characters = s.characters.filter((c) => c.id !== id);
      return { ...s, characters, activeId: s.activeId === id ? (characters[0]?.id ?? null) : s.activeId };
    });
  }, []);

  const select = useCallback((id: string) => setState((s) => ({ ...s, activeId: id })), []);

  return { characters: state.characters, active, upsert, update, remove, select };
}
