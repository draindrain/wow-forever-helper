import { useEffect, useRef, useState } from 'react';
import { MAX_LEVEL } from '../data';
import { classIcon, factionIcon } from '../lib/icons';
import type { Character, ClassMeta, Race, Spec } from '../types';
import { Icon } from './ui';

interface Props {
  character: Character;
  race: Race;
  cls: ClassMeta;
  spec: Spec;
  onLevel: (level: number) => void;
}

export function Nameplate({ character, race, cls, spec, onLevel }: Props) {
  const level = character.level;
  const [ding, setDing] = useState(false);
  const previous = useRef(level);

  // Flash a "Ding!" when the level goes up (not when switching characters).
  const id = useRef(character.id);
  useEffect(() => {
    if (id.current === character.id && level > previous.current) {
      setDing(true);
      const t = setTimeout(() => setDing(false), 1600);
      previous.current = level;
      return () => clearTimeout(t);
    }
    id.current = character.id;
    previous.current = level;
  }, [level, character.id]);

  // + / - keys change level while focus isn't in a text field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '+' || e.key === '=') onLevel(level + 1);
      else if (e.key === '-' || e.key === '_') onLevel(level - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [level, onLevel]);

  return (
    <div className={`nameplate class-${cls.id} ${ding ? 'is-ding' : ''}`}>
      <div className="portrait">
        <Icon icon={classIcon(cls.id)} size={56} />
        <span className="portrait-level" aria-hidden="true">
          {level}
        </span>
      </div>
      <div className="nameplate-text">
        <div className="nameplate-name class-color">{character.name}</div>
        <div className="nameplate-sub">
          <Icon icon={factionIcon(race.faction)} size={16} /> Level {level} {race.name} {cls.name}
          <span className="nameplate-spec"> · {spec.name}</span>
        </div>
      </div>
      <div className="level-control" role="group" aria-label="Character level">
        <button
          type="button"
          className="level-btn"
          onClick={() => onLevel(level - 1)}
          disabled={level <= 1}
          aria-label="Level down"
          title="Level down (−)"
        >
          −
        </button>
        <div className="level-display">
          <span className="level-label">Level</span>
          <span className="level-value" aria-live="polite">
            {level}
          </span>
        </div>
        <button
          type="button"
          className="level-btn level-up"
          onClick={() => onLevel(level + 1)}
          disabled={level >= MAX_LEVEL}
          aria-label="Level up"
          title="Level up (+)"
        >
          +
        </button>
      </div>
      {ding && (
        <div className="ding" aria-hidden="true">
          Ding! Level {level}
        </div>
      )}
    </div>
  );
}
