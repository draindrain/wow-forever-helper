import { useEffect, useRef, useState } from 'react';
import { MAX_LEVEL } from '../data';
import { classIcon, factionIcon } from '../lib/icons';
import type { Character, ClassMeta, Race, Spec } from '../types';
import { CharacterSwitcher } from './CharacterSwitcher';
import { NewsBell } from './NewsBell';
import { TABS, type TabId } from './tabs/types';
import { Icon } from './ui';

interface Props {
  characters: Character[];
  active: Character | null;
  race?: Race;
  cls?: ClassMeta;
  spec?: Spec;
  tab: TabId;
  showTabs: boolean;
  onTab: (tab: TabId) => void;
  onLevel: (level: number) => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onEdit: () => void;
  onAbout: () => void;
}

export function Header(props: Props) {
  const { active, race, cls, spec, tab, showTabs, onTab, onLevel } = props;
  const level = active?.level ?? 1;

  // Shortcuts while focus isn't in a text field or a dialog: + / - change level, 1-4 switch tabs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable], dialog') || e.ctrlKey || e.metaKey || e.altKey)
        return;
      if (document.querySelector('dialog[open]')) return;
      if (!active || !showTabs) return;
      if (e.key === '+' || e.key === '=') onLevel(level + 1);
      else if (e.key === '-' || e.key === '_') onLevel(level - 1);
      else {
        const t = TABS[Number(e.key) - 1];
        if (t) onTab(t.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, showTabs, level, onLevel, onTab]);

  return (
    <header className="site-header">
      <a className="brand" href={import.meta.env.BASE_URL} title="WoW Forever Helper">
        <img className="brand-mark" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={34} height={34} />
        <span className="brand-text">
          WoW Forever <span>Helper</span>
        </span>
      </a>

      {active && race && cls && spec && <Nameplate character={active} race={race} cls={cls} spec={spec} />}

      {active && showTabs && (
        <nav className="tabs main-tabs" role="tablist" aria-label="Sections">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`tab ${tab === t.id ? 'is-active' : ''}`}
              onClick={() => onTab(t.id)}
              title={`${t.label} (${i + 1})`}
            >
              <span className="tab-long">{t.label}</span>
              <span className="tab-short">{t.short}</span>
            </button>
          ))}
        </nav>
      )}

      <span className="spacer" />

      {active && showTabs && (
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
      )}

      {active && (
        <CharacterSwitcher
          characters={props.characters}
          active={active}
          onSelect={props.onSelect}
          onNew={props.onNew}
          onEdit={props.onEdit}
        />
      )}
      <NewsBell />
      <button
        type="button"
        className="icon-button"
        onClick={props.onAbout}
        aria-label="About and data sources"
        title="About and data sources"
      >
        ?
      </button>
    </header>
  );
}

function Nameplate({ character, race, cls, spec }: { character: Character; race: Race; cls: ClassMeta; spec: Spec }) {
  const level = character.level;
  const [ding, setDing] = useState(false);
  const previous = useRef({ id: character.id, level });

  // Flash a "Ding!" when the level goes up (not when switching characters).
  useEffect(() => {
    const prev = previous.current;
    previous.current = { id: character.id, level };
    if (prev.id !== character.id || level <= prev.level) return;
    setDing(true);
    const t = setTimeout(() => setDing(false), 1600);
    return () => clearTimeout(t);
  }, [level, character.id]);

  return (
    <div className={`nameplate class-${cls.id} ${ding ? 'is-ding' : ''}`}>
      <div className="portrait">
        <Icon icon={classIcon(cls.id)} size={44} />
        <span className="portrait-level" aria-hidden="true">
          {level}
        </span>
      </div>
      <div className="nameplate-text">
        <div className="nameplate-name class-color">{character.name}</div>
        <div className="nameplate-sub">
          <Icon icon={factionIcon(race.faction)} size={14} />
          <span className="nameplate-sub-text">
            {race.name} {cls.name}
            <span className="nameplate-spec"> · {spec.name}</span>
          </span>
        </div>
      </div>
      {ding && (
        <div className="ding" aria-hidden="true">
          Ding! Level {level}
        </div>
      )}
    </div>
  );
}
