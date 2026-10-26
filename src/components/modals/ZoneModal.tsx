import { useMemo, useState } from 'react';
import { loadZoneQuests, zoneById } from '../../data';
import { DoneContext, isDone, useDone, type DoneApi } from '../../lib/done';
import { levelColor } from '../../lib/game';
import { useAsync } from '../../lib/useAsync';
import type { Character, ClassMeta, Quest, Race } from '../../types';
import { Badge } from '../ui';
import { Modal } from './Modal';
import { hideDone, QuestList, questsFor } from './QuestList';
import { QuestMap } from './QuestMap';
import { ShowDone, useQuestFocus } from './QuestViews';

type Scope = 'near' | 'all';

export function ZoneModal({
  zoneId,
  character,
  race,
  cls,
  onClose,
}: {
  zoneId: number;
  character: Character;
  race: Race;
  cls: ClassMeta;
  onClose: () => void;
}) {
  const zone = zoneById(zoneId);
  const bundle = useAsync(`zone-quests:${zoneId}`, () => loadZoneQuests(zoneId));
  const [scope, setScope] = useState<Scope>('near');
  const [showDone, setShowDone] = useState(false);
  const focus = useQuestFocus();
  const level = character.level;
  const range = zone?.factions[race.faction];
  const outer = useDone();
  const { done } = outer;
  // Quests marked done here come off this zone's counts.
  const doneApi = useMemo<DoneApi>(() => ({ done, toggle: (q) => outer.toggle(q, zoneId) }), [outer, done, zoneId]);

  const mine = bundle ? questsFor(bundle.quests, race, cls) : [];
  const open = mine.filter((q) => !isDone(done, q.id));
  // "Near my level": quests that still give XP and aren't far above you.
  const isNear = (q: Quest) => levelColor(q.level, level) !== 'grey' && q.level <= level + 6;
  const near = open.filter(isNear);
  const inScope = scope === 'near' ? mine.filter(isNear) : mine;
  const shown = hideDone(inScope, done, showDone);
  const doneCount = inScope.filter((q) => isDone(done, q.id)).length;

  return (
    <DoneContext.Provider value={doneApi}>
      <Modal
        title={zone?.name ?? 'Zone'}
        icon="inv_misc_map_01"
        subtitle={
          <>
            {range && (
              <span className="zone-range">{range.min === range.max ? range.min : `${range.min}–${range.max}`}</span>
            )}
            {zone && <span className={`territory territory-${zone.territory.toLowerCase()}`}>{zone.territory}</span>}
            {zone && <span className="muted">{zone.continent}</span>}
            {zone?.isNew && <Badge tone="green">New in Forever</Badge>}
          </>
        }
        onClose={onClose}
      >
        <div className="modal-split">
          <aside className="modal-side">
            <QuestMap zoneId={zoneId} quests={hideDone(shown, done, false)} level={level} {...focus} />
            {zone?.note && <p className="small muted">{zone.note}</p>}
            {zone && zone.nodes.length > 0 && (
              <div className="node-row small">
                <span className="muted">Gathering:</span>
                {zone.nodes.map((n) => (
                  <span key={n.name} className={`node node-${n.kind}`}>
                    {n.name} <span className="muted">{n.skill}</span>
                  </span>
                ))}
              </div>
            )}
          </aside>
          <section className="modal-main">
            <div className="modal-toolbar">
              <div className="tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={scope === 'near'}
                  className={`tab ${scope === 'near' ? 'is-active' : ''}`}
                  onClick={() => setScope('near')}
                >
                  Near level {level} <span className="tab-count">{near.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={scope === 'all'}
                  className={`tab ${scope === 'all' ? 'is-active' : ''}`}
                  onClick={() => setScope('all')}
                >
                  All {race.faction} quests <span className="tab-count">{open.length}</span>
                </button>
              </div>
              <ShowDone count={doneCount} show={showDone} onChange={setShowDone} />
            </div>
            <div className="modal-scroll">
              {!bundle ? (
                <p className="muted">{bundle === null ? 'No quest data for this zone yet.' : 'Loading quests…'}</p>
              ) : shown.length ? (
                <QuestList
                  quests={shown}
                  takeable={mine}
                  faction={race.faction}
                  bundle={bundle}
                  level={level}
                  here={zoneId}
                  {...focus}
                />
              ) : doneCount ? (
                <p className="muted">
                  You've done every {scope === 'near' ? 'quest near your level' : 'quest'} here.{' '}
                  <button type="button" className="link-button" onClick={() => setShowDone(true)}>
                    Show done
                  </button>
                </p>
              ) : (
                <p className="muted">
                  No quests near your level here.{' '}
                  <button type="button" className="link-button" onClick={() => setScope('all')}>
                    Show all
                  </button>
                </p>
              )}
            </div>
            <p className="source small muted">
              Quests, givers, map positions and rewards from Wowhead's Forever database; map © Blizzard via Wowhead.
            </p>
          </section>
        </div>
      </Modal>
    </DoneContext.Provider>
  );
}
