import { useCallback, useState, type ReactNode } from 'react';
import { classById, loadClass, raceById } from './data';
import { clampLevel, useCharacters } from './lib/characters';
import type { EventContext } from './lib/events';
import { useAsync } from './lib/useAsync';
import { AboutDialog } from './components/AboutDialog';
import { CharacterForm } from './components/CharacterForm';
import { Header } from './components/Header';
import { ClassTab } from './components/tabs/ClassTab';
import { OverviewTab } from './components/tabs/OverviewTab';
import { QuestsTab } from './components/tabs/QuestsTab';
import { TradeTab } from './components/tabs/TradeTab';
import { TABS, type TabId, type TabProps } from './components/tabs/types';

type Editing = { mode: 'new' } | { mode: 'edit'; id: string } | null;

const TAB_KEY = 'wow-forever-helper:tab';

function savedTab(): TabId {
  try {
    const t = localStorage.getItem(TAB_KEY);
    return TABS.some((x) => x.id === t) ? (t as TabId) : 'overview';
  } catch {
    return 'overview';
  }
}

const tabViews: Record<TabId, (props: TabProps) => ReactNode> = {
  overview: OverviewTab,
  class: ClassTab,
  quests: QuestsTab,
  trade: TradeTab,
};

export default function App() {
  const store = useCharacters();
  const [editing, setEditing] = useState<Editing>(null);
  const [tab, setTabState] = useState<TabId>(savedTab);
  const [about, setAbout] = useState(false);
  const active = store.active;

  const race = active ? raceById(active.race) : undefined;
  const cls = active ? classById(active.classId) : undefined;
  const spec = cls?.specs.find((s) => s.id === active?.spec);
  const classData = useAsync(`class:${active?.classId ?? ''}`, () =>
    active ? loadClass(active.classId) : Promise.resolve(null),
  );

  const setTab = useCallback((t: TabId) => {
    setTabState(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      // Not remembering the tab is fine.
    }
  }, []);
  const { update } = store;
  const activeId = active?.id;
  const setLevel = useCallback(
    (level: number) => activeId && update(activeId, (c) => ({ ...c, level: clampLevel(level) })),
    [activeId, update],
  );
  const setSkill = useCallback(
    (id: string, skill: number) =>
      activeId &&
      update(activeId, (c) => ({ ...c, professions: c.professions.map((p) => (p.id === id ? { ...p, skill } : p)) })),
    [activeId, update],
  );

  const editingCharacter = editing?.mode === 'edit' ? store.characters.find((c) => c.id === editing.id) : undefined;
  const valid = active && race && cls && spec;
  const showForm = !active || editing || !valid;

  const ctx: EventContext | null =
    valid && classData && classData.id === active.classId ? { character: active, race, spec, classData } : null;
  const View = tabViews[tab];

  return (
    <div className="app">
      <Header
        characters={store.characters}
        active={active}
        race={race}
        cls={cls}
        spec={spec}
        tab={tab}
        showTabs={!showForm}
        onTab={setTab}
        onLevel={setLevel}
        onSelect={(id) => {
          store.select(id);
          setEditing(null);
        }}
        onNew={() => setEditing({ mode: 'new' })}
        onEdit={() => active && setEditing({ mode: 'edit', id: active.id })}
        onAbout={() => setAbout(true)}
      />

      <main className="main">
        {showForm ? (
          <section className="panel form-panel">
            <header className="panel-title">
              <h2>
                {editingCharacter
                  ? `Edit ${editingCharacter.name}`
                  : active && !valid
                    ? `Fix ${active.name}`
                    : 'Create your character'}
              </h2>
            </header>
            <div className="panel-body form-body">
              {!active && (
                <p className="intro">
                  Keep this page open on a second screen while you level in World of Warcraft: Forever. Tell it who
                  you're playing and bump the level each time you ding. Everything you need fits on one screen: what's
                  new at your trainer, where to quest, which dungeons fit and what your trade skills can make.
                </p>
              )}
              <CharacterForm
                key={editingCharacter?.id ?? (active && !valid ? active.id : 'new')}
                initial={editingCharacter ?? (active && !valid ? active : undefined)}
                onSave={(c) => {
                  store.upsert(c);
                  setEditing(null);
                }}
                onCancel={active && valid ? () => setEditing(null) : undefined}
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
          <View
            key={`${active.id}-${tab}`}
            ctx={ctx}
            character={active}
            race={race}
            cls={cls}
            spec={spec}
            onSkill={setSkill}
            onTab={setTab}
          />
        )}
      </main>

      <AboutDialog open={about} onClose={() => setAbout(false)} />
    </div>
  );
}
