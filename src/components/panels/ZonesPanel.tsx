import { useState } from 'react';
import { zones } from '../../data';
import { suggestZones, type ZoneFit } from '../../lib/game';
import type { Character, Race } from '../../types';
import { Badge, Empty, LevelTrack, Panel, Tooltip } from '../ui';

const fitLabel: Record<ZoneFit, string> = {
  ideal: 'Right level',
  early: 'A bit high',
  late: 'Wrapping up',
  other: 'Some quests',
};
const fitTone: Record<ZoneFit, string> = { ideal: 'yellow', early: 'orange', late: 'green', other: 'grey' };
const SHOWN = 6;

export function ZonesPanel({ character, race }: { character: Character; race: Race }) {
  const [all, setAll] = useState(false);
  const level = character.level;
  const suggestions = suggestZones(zones, race, level);
  const gathers = {
    herb: character.professions.find((p) => p.id === 'herbalism'),
    ore: character.professions.find((p) => p.id === 'mining'),
  };
  const shown = all ? suggestions : suggestions.slice(0, SHOWN);

  return (
    <Panel title="Where to quest" icon="inv_misc_map_01" className="panel-zones">
      {shown.length ? (
        <ul className="zone-list">
          {shown.map((s) => {
            const nodes = s.zone.nodes.filter((n) => {
              const prof = gathers[n.kind];
              return prof && n.skill <= prof.skill;
            });
            return (
              <li key={s.zone.id} className={`zone fit-${s.fit}`}>
                <div className="zone-head">
                  <span className="zone-name">
                    {s.zone.name}
                    {s.zone.isNew && <span className="status-mark status-new" title="New in Forever">★</span>}
                  </span>
                  <span className="zone-range">
                    {s.min === s.max ? s.min : `${s.min}–${s.max}`}
                    {s.estimated && (
                      <Tooltip content={s.zone.note ?? 'Range estimated: few quests catalogued yet.'}>
                        <sup className="muted">?</sup>
                      </Tooltip>
                    )}
                  </span>
                </div>
                <LevelTrack min={s.min} max={s.max} level={level} />
                <div className="zone-meta">
                  <span className={`territory territory-${s.zone.territory.toLowerCase()}`}>{s.zone.territory}</span>
                  <span className="muted">{s.zone.continent}</span>
                  <Badge tone={fitTone[s.fit]}>{fitLabel[s.fit]}</Badge>
                  {s.isStart && <Badge tone="blue">Your start zone</Badge>}
                </div>
                {!s.estimated && (
                  <div className="zone-quests">
                    <span className="q-yellow">{s.goodQuests}</span> quests at your level
                    {s.greenQuests > 0 && (
                      <>
                        {' '}
                        · <span className="q-green">{s.greenQuests}</span> easy
                      </>
                    )}
                  </div>
                )}
                {s.zone.note && !s.estimated && <div className="zone-note muted small">{s.zone.note}</div>}
                {nodes.length > 0 && (
                  <div className="zone-nodes small">
                    {nodes.map((n) => (
                      <span key={n.name} className={`node node-${n.kind}`} title={`Needs ${n.skill} skill`}>
                        {n.name}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>No zones found for this level yet.</Empty>
      )}
      {suggestions.length > SHOWN && (
        <button type="button" className="link-button" onClick={() => setAll((v) => !v)}>
          {all ? 'Show fewer' : `Show ${suggestions.length - SHOWN} more`}
        </button>
      )}
      <p className="source small muted">
        Ranges are the middle 80% of each zone's {race.faction} quest levels in Wowhead's Forever database. "At your
        level" counts yellow and orange quests.
      </p>
    </Panel>
  );
}
