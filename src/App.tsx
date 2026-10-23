import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { classById, loadClass, meta, raceById } from './data';
import { clampLevel, useCharacters } from './lib/characters';
import type { EventContext } from './lib/events';
import { useAsync } from './lib/useAsync';
import type { Character } from './types';
import { CharacterForm } from './components/CharacterForm';
import { Nameplate } from './components/Nameplate';
import { ComingUpPanel, ThisLevelPanel } from './components/panels/LevelPanels';
import { DungeonsPanel } from './components/panels/DungeonsPanel';
import { ProfessionsPanel } from './components/panels/ProfessionsPanel';
import { SpellbookPanel } from './components/panels/SpellbookPanel';
import { ZonesPanel } from './components/panels/ZonesPanel';
import { CharacterSwitcher } from './components/CharacterSwitcher';

type Editing = { mode: 'new' } | { mode: 'edit'; id: string } | null;

export default function App() {
  const store = useCharacters();
  const [editing, setEditing] = useState<Editing>(null);
  const active = store.active;

  const editingCharacter = editing?.mode === 'edit' ? store.characters.find((c) => c.id === editing.id) : undefined;
  const showForm = !active || editing;

  return (
    <div className="app">
      <header className="site-header">
        <a className="brand" href={import.meta.env.BASE_URL}>
          <img className="brand-mark" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={34} height={34} />
          <span className="brand-text">
            WoW Forever <span>Helper</span>
          </span>
        </a>
        {active && (
          <CharacterSwitcher
            characters={store.characters}
            active={active}
            onSelect={(id) => {
              store.select(id);
              setEditing(null);
            }}
            onNew={() => setEditing({ mode: 'new' })}
            onEdit={() => setEditing({ mode: 'edit', id: active.id })}
          />
        )}
      </header>

      {showForm ? (
        <section className="panel form-panel">
          <header className="panel-title">
            <h2>{editingCharacter ? `Edit ${editingCharacter.name}` : 'Create your character'}</h2>
          </header>
          <div className="panel-body">
            {!active && (
              <p className="intro">
                Keep this page open on a second screen while you level in World of Warcraft: Forever. Tell it who
                you're playing, bump the level each time you ding, and it shows what's new at your trainer, where to
                quest, which dungeons fit, and what your trade skills can make.
              </p>
            )}
            <CharacterForm
              key={editingCharacter?.id ?? 'new'}
              initial={editingCharacter}
              onSave={(c) => {
                store.upsert(c);
                setEditing(null);
              }}
              onCancel={active ? () => setEditing(null) : undefined}
              onDelete={
                editingCharacter
                  ? () => {
                      if (confirm(`Delete ${editingCharacter.name}? This can't be undone.`)) {
                        store.remove(editingCharacter.id);
                        setEditing(null);
                      }
                    }
                  : undefined
              }
            />
          </div>
        </section>
      ) : (
        <Dashboard
          key={active.id}
          character={active}
          onChange={(change) => store.update(active.id, change)}
          onEdit={() => setEditing({ mode: 'edit', id: active.id })}
        />
      )}

      <footer className="site-footer">
        <p>
          Data from the WoW Forever beta client (build {meta.clientBuild}): spells, recipes, races and dungeons via{' '}
          <a href="https://wowforevertalents.com/">wowforevertalents.com</a> and{' '}
          <a href="https://wago.tools/">wago.tools</a>; zone quests and gathering nodes from{' '}
          <a href="https://www.wowhead.com/forever">Wowhead's Forever database</a>; dungeon level ranges as announced by
          Blizzard. Icons via Wowhead. Updated {meta.generatedAt}.
        </p>
        <p>
          Fan-made and unofficial. World of Warcraft is a trademark of Blizzard Entertainment, Inc. Your characters are
          saved in this browser only.
        </p>
      </footer>
    </div>
  );
}

function useColumnCount() {
  const query = () => (window.matchMedia('(min-width: 1320px)').matches ? 3 : window.matchMedia('(min-width: 860px)').matches ? 2 : 1);
  const [count, setCount] = useState(query);
  useEffect(() => {
    const onResize = () => setCount(query());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return count;
}

function Dashboard({
  character,
  onChange,
  onEdit,
}: {
  character: Character;
  onChange: (change: (c: Character) => Character) => void;
  onEdit: () => void;
}) {
  const race = raceById(character.race);
  const cls = classById(character.classId);
  const spec = cls?.specs.find((s) => s.id === character.spec);
  const classData = useAsync(`class:${character.classId}`, () => loadClass(character.classId));
  const columns = useColumnCount();

  const setLevel = useCallback((level: number) => onChange((c) => ({ ...c, level: clampLevel(level) })), [onChange]);
  const setSkill = useCallback(
    (id: string, skill: number) =>
      onChange((c) => ({ ...c, professions: c.professions.map((p) => (p.id === id ? { ...p, skill } : p)) })),
    [onChange],
  );

  if (!race || !cls || !spec) {
    return (
      <p className="notice">
        This character uses a race, class or spec the current data doesn't have.{' '}
        <button type="button" className="link-button" onClick={onEdit}>
          Edit it
        </button>
      </p>
    );
  }

  const ctx: EventContext | null = classData ? { character, race, spec, classData } : null;
  const loading = <p className="muted">Loading spellbook…</p>;
  const panels: Record<string, ReactNode> = {
    level: ctx ? <ThisLevelPanel ctx={ctx} /> : loading,
    coming: ctx ? <ComingUpPanel ctx={ctx} /> : null,
    zones: <ZonesPanel character={character} race={race} />,
    dungeons: <DungeonsPanel race={race} level={character.level} />,
    professions: <ProfessionsPanel character={character} faction={race.faction} onSkill={setSkill} onEdit={onEdit} />,
    spellbook: ctx ? <SpellbookPanel ctx={ctx} /> : null,
  };
  const layouts: Record<number, string[][]> = {
    3: [['level', 'coming', 'spellbook'], ['zones', 'dungeons'], ['professions']],
    2: [['level', 'coming', 'spellbook'], ['zones', 'dungeons', 'professions']],
    1: [['level', 'zones', 'dungeons', 'coming', 'professions', 'spellbook']],
  };

  return (
    <>
      <Nameplate character={character} race={race} cls={cls} spec={spec} onLevel={setLevel} />
      <main className={`dashboard cols-${columns}`}>
        {layouts[columns]!.map((col, i) => (
          <div key={i} className="dashboard-col">
            {col.map((id) => (
              <div key={id} className="dashboard-cell">
                {panels[id]}
              </div>
            ))}
          </div>
        ))}
      </main>
    </>
  );
}
