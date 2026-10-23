import { instances, MAX_LEVEL } from '../../data';
import { dungeonFit, dungeonsFor, type DungeonFit } from '../../lib/game';
import type { Race } from '../../types';
import { Badge, Empty, LevelTrack, Panel, StatusMark } from '../ui';

const fitLabel: Record<DungeonFit, string> = {
  locked: 'Can’t enter yet',
  hard: 'Challenging',
  ideal: 'Right level',
  easy: 'Easy',
  grey: 'Too low',
};
const fitTone: Record<DungeonFit, string> = {
  locked: 'red',
  hard: 'orange',
  ideal: 'yellow',
  easy: 'green',
  grey: 'grey',
};

export function DungeonsPanel({ race, level }: { race: Race; level: number }) {
  const list = dungeonsFor(instances.dungeons, race.faction, level);
  const nextUp = instances.dungeons
    .filter((d) => d.min > level + 3 && (!d.faction || d.faction === race.faction))
    .sort((a, b) => a.min - b.min)[0];
  const battlegrounds = instances.battlegrounds.filter((b) => b.min <= level);

  return (
    <Panel title="Dungeons" icon="inv_misc_head_dragon_black" className="panel-dungeons">
      {list.length ? (
        <ul className="dungeon-list">
          {list.map((d) => {
            const fit = dungeonFit(d, level);
            return (
              <li key={d.id} className={`dungeon fit-${fit}`}>
                <div className="zone-head">
                  <span className="zone-name">
                    {d.name}
                    {d.isNew && <StatusMark status="new" />}
                  </span>
                  <span className="zone-range">
                    {d.min}–{d.max}
                  </span>
                </div>
                <LevelTrack min={d.min} max={d.max} level={level} />
                <div className="zone-meta">
                  <span className="muted">{d.zone}</span>
                  <span className="muted">{d.players}-player</span>
                  {d.entryLevel && <span className="muted">Entry {d.entryLevel}+</span>}
                  <Badge tone={fitTone[fit]}>{fitLabel[fit]}</Badge>
                </div>
                {d.bosses.length > 0 ? (
                  <details className="bosses">
                    <summary>{d.bosses.length} bosses</summary>
                    <ol>
                      {d.bosses.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ol>
                  </details>
                ) : (
                  !d.inClient && <div className="small muted">Announced; not in the current client build.</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>
          {level < 10 ? 'No dungeons yet: the first ones open in your early teens.' : 'No dungeons near your level.'}
        </Empty>
      )}
      {nextUp && (
        <p className="small muted">
          Next: <b>{nextUp.name}</b> ({nextUp.min}–{nextUp.max}, {nextUp.zone})
        </p>
      )}
      {battlegrounds.length > 0 && (
        <div className="bg-row small">
          <span className="muted">Battlegrounds:</span>
          {battlegrounds.map((b) => (
            <span key={b.id} className="bg-chip">
              {b.name} <span className="muted">{b.size}</span>
            </span>
          ))}
        </div>
      )}
      {level >= MAX_LEVEL && (
        <div className="bg-row small">
          <span className="muted">Raids:</span>
          {instances.raids.map((r) => (
            <span key={r.id} className="bg-chip">
              {r.name} <span className="muted">{r.size}-player</span>
            </span>
          ))}
        </div>
      )}
      <p className="source small muted">Level ranges as announced by Blizzard; entry levels and bosses from the Forever client.</p>
    </Panel>
  );
}
