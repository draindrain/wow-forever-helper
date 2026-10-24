import { instances, MAX_LEVEL, zones } from '../../data';
import { dungeonsFor, suggestZones, upcomingZones } from '../../lib/game';
import { FitList } from '../FitList';
import { DungeonRow, ZoneRow } from '../rows';
import { Panel, StatusMark } from '../ui';
import type { TabProps } from './types';

export function QuestsTab({ character, race }: TabProps) {
  const level = character.level;
  const zoneList = suggestZones(zones, race, level);
  const nextZones = upcomingZones(zones, race, level);
  const forFaction = instances.dungeons.filter((d) => !d.faction || d.faction === race.faction);
  const dungeonList = dungeonsFor(forFaction, race.faction, level);
  const later = forFaction.filter((d) => d.min > level + 3).sort((a, b) => a.min - b.min);
  const battlegrounds = instances.battlegrounds;

  return (
    <div className="tab-grid tab-quests">
      <Panel title="Where to quest" icon="inv_misc_map_01">
        <FitList className="zone-grid">
          {zoneList.length ? (
            zoneList.map((s) => <ZoneRow key={s.zone.id} s={s} character={character} />)
          ) : (
            <li className="empty">No zones found for this level yet.</li>
          )}
          {nextZones.length > 0 && (
            <li className="coming-heading grid-heading" data-fit-heading>
              Next zones <span className="muted">· within 10 levels</span>
            </li>
          )}
          {nextZones.map((s) => (
            <ZoneRow key={s.zone.id} s={s} character={character} />
          ))}
        </FitList>
        <p className="source small muted">
          Ranges are the middle 80% of each zone's {race.faction} quest levels in Wowhead's Forever database. Quest
          counts are yellow/orange quests at your level, plus green "easy" ones.
        </p>
      </Panel>

      <Panel title="Dungeons" icon="inv_misc_head_dragon_black">
        <FitList className="dungeon-list">
          {dungeonList.length ? (
            dungeonList.map((d) => <DungeonRow key={d.id} d={d} level={level} />)
          ) : (
            <li className="empty">
              {level < 10
                ? 'No dungeons yet: the first ones open in your early teens.'
                : 'No dungeons near your level.'}
            </li>
          )}
        </FitList>
        <p className="source small muted">
          Level ranges as announced by Blizzard; entry levels and bosses from the client.
        </p>
      </Panel>

      <div className="stack">
        <Panel title="Later dungeons" icon="inv_misc_map_01" className="grow-3">
          <FitList className="mini-list">
            {later.map((d) => (
              <li key={d.id} className="mini-row">
                <span>
                  {d.name}
                  {d.isNew && <StatusMark status="new" />}
                </span>
                <span className="muted">{d.zone}</span>
                <b>
                  {d.min}–{d.max}
                </b>
              </li>
            ))}
            {!later.length && <li className="empty">You've reached every dungeon.</li>}
          </FitList>
        </Panel>
        <Panel
          title="PvP & raids"
          icon={race.faction === 'Alliance' ? 'inv_bannerpvp_02' : 'inv_bannerpvp_01'}
          className="grow-2"
        >
          <FitList className="mini-list">
            {battlegrounds.map((b) => (
              <li key={b.id} className={`mini-row ${b.min > level ? 'is-future' : ''}`}>
                <span>
                  {b.name}
                  {b.isNew && <StatusMark status="new" />}
                </span>
                <span className="muted">{b.size}</span>
                <b>{b.min > level ? `at ${b.min}` : 'Open'}</b>
              </li>
            ))}
            {instances.raids.map((r) => (
              <li key={r.id} className={`mini-row ${level < MAX_LEVEL ? 'is-future' : ''}`}>
                <span>
                  {r.name}
                  {r.isNew && <StatusMark status="new" />}
                </span>
                <span className="muted">{r.size}-player raid</span>
                <b>{level < MAX_LEVEL ? 'at 60' : '9 Dec'}</b>
              </li>
            ))}
          </FitList>
        </Panel>
      </div>
    </div>
  );
}
