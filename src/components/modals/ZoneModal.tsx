import { useState } from 'react';
import { loadZoneQuests, zoneById } from '../../data';
import { levelColor } from '../../lib/game';
import { useAsync } from '../../lib/useAsync';
import type { Character, ClassMeta, Race } from '../../types';
import { Badge } from '../ui';
import { Modal } from './Modal';
import { QuestList, questsFor } from './QuestList';
import { QuestMap } from './QuestMap';

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
  const [hovered, setHovered] = useState<number>();
  const level = character.level;
  const range = zone?.factions[race.faction];

  const mine = bundle ? questsFor(bundle.quests, race, cls) : [];
  // "Near my level": quests that still give XP and aren't far above you.
  const near = mine.filter((q) => levelColor(q.level, level) !== 'grey' && q.level <= level + 6);
  const shown = scope === 'near' ? near : mine;

  return (
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
          <QuestMap zoneId={zoneId} quests={shown} level={level} hovered={hovered} onHover={setHovered} />
          <div className="map-legend small">
            <span>
              <span className="pin pin-start pin-yellow">!</span> Pick up
            </span>
            <span>
              <span className="pin pin-end pin-yellow">?</span> Turn in
            </span>
            <span className="muted">Colour shows the quest's difficulty for you. Hover a quest to find it.</span>
          </div>
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
                All {race.faction} quests <span className="tab-count">{mine.length}</span>
              </button>
            </div>
          </div>
          <div className="modal-scroll">
            {!bundle ? (
              <p className="muted">{bundle === null ? 'No quest data for this zone yet.' : 'Loading quests…'}</p>
            ) : shown.length ? (
              <QuestList
                quests={shown}
                bundle={bundle}
                level={level}
                here={zoneId}
                hovered={hovered}
                onHover={setHovered}
              />
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
  );
}
