import { BETA_LEVEL_CAP, cities, instances, MAX_LEVEL, zones } from '../../data';
import { eventsAt, nextTrainingLevel, type EventContext } from '../../lib/events';
import { cityQuests, dungeonsFor, suggestZones, upcomingZones } from '../../lib/game';
import { FitList } from '../FitList';
import { ProfessionSummary } from '../ProfessionCard';
import { CityRow, DungeonRow, EventRow, sortEvents, ZoneRow } from '../rows';
import { Panel, stackShare } from '../ui';
import type { TabId, TabProps } from './types';

/** How far ahead "Coming up" looks; the list shows as many levels as fit. */
const LOOKAHEAD = 10;

export function StatRow({ ctx }: { ctx: EventContext }) {
  const level = ctx.character.level;
  const next = nextTrainingLevel(ctx, level);
  const talentPoints = Math.max(0, level - 9);
  return (
    <div className="stat-row">
      <span>
        <b>{talentPoints}</b> talent point{talentPoints === 1 ? '' : 's'}
      </span>
      <span>
        {next ? (
          <>
            Next trainer visit: <b>level {next}</b>
          </>
        ) : (
          'Nothing left to train'
        )}
      </span>
    </div>
  );
}

export function BetaNotice({ level }: { level: number }) {
  if (level <= BETA_LEVEL_CAP) return null;
  return (
    <p className="notice" title="Spells, dungeons and quests above 30 come from client data and may change at launch.">
      Past the beta's level {BETA_LEVEL_CAP} cap: untested client data.
    </p>
  );
}

/**
 * Height "New at level" needs to show its rows (up to six) under its title and stats,
 * for sizing it when it shares a column.
 */
export function newAtLevelMinHeight(rows: number, level: number) {
  const ROW = 54;
  return 104 + (level > BETA_LEVEL_CAP ? 40 : 0) + Math.min(Math.max(rows, 1), 6) * ROW + (rows > 6 ? 24 : 0);
}

export function NewAtLevel({ ctx, onTab }: { ctx: EventContext; onTab?: (tab: TabId) => void }) {
  const level = ctx.character.level;
  const events = sortEvents(eventsAt(ctx, level), ctx);
  return (
    <Panel title={`New at level ${level}`} icon="spell_holy_borrowedtime">
      <StatRow ctx={ctx} />
      <BetaNotice level={level} />
      <FitList className="event-list" onMore={onTab && (() => onTab('class'))} moreLabel={onTab && 'Class skills'}>
        {events.length ? (
          events.map((e, i) => <EventRow key={i} event={e} ctx={ctx} />)
        ) : (
          <li className="empty">Nothing new at the trainer this level. Keep questing!</li>
        )}
      </FitList>
    </Panel>
  );
}

export function OverviewTab({ ctx, character, race, onSkill, onTab }: TabProps) {
  const level = character.level;
  const zoneList = suggestZones(zones, race, level, character.done);
  const nextZones = upcomingZones(zones, race, level, character.done);
  // Cities only when they have quests at your level.
  const cityList = cityQuests(cities, race, level, character.done).filter((s) => s.quests > 0);
  const newCount = ctx ? eventsAt(ctx, level).length : 3;
  const dungeonList = dungeonsFor(instances.dungeons, race.faction, level);
  const nextDungeon = instances.dungeons
    .filter((d) => d.min > level + 3 && (!d.faction || d.faction === race.faction))
    .sort((a, b) => a.min - b.min)[0];

  const coming = [];
  if (ctx) {
    for (let l = level + 1; l <= Math.min(MAX_LEVEL, level + LOOKAHEAD); l++) {
      const events = sortEvents(eventsAt(ctx, l), ctx);
      if (!events.length) continue;
      coming.push(
        <li key={`h${l}`} className="coming-heading" data-fit-heading>
          Level {l} <span className="muted">· in {l - level}</span>
        </li>,
        ...events.map((e, i) => <EventRow key={`${l}-${i}`} event={e} ctx={ctx} compact />),
      );
    }
  }

  return (
    <div className="tab-grid tab-overview">
      <div className="stack">
        {/* Split the column by how many rows each panel has; "new" always keeps room for one row. */}
        <div className="stack-item" style={stackShare(Math.max(newCount, 1) + 3, newAtLevelMinHeight(newCount, level))}>
          {ctx ? <NewAtLevel ctx={ctx} onTab={onTab} /> : <Panel title="New at level">Loading…</Panel>}
        </div>
        <div className="stack-item" style={stackShare(Math.max(dungeonList.length, 1) + 2)}>
          <Panel title="Dungeons" icon="inv_misc_head_dragon_black">
            <FitList className="dungeon-list" onMore={() => onTab('quests')} moreLabel="Quests & dungeons">
              {dungeonList.map((d) => (
                <DungeonRow key={d.id} d={d} level={level} compact />
              ))}
              {!dungeonList.length && (
                <li className="empty">
                  {level < 10 ? 'No dungeons yet: the first open in your early teens.' : 'None near your level.'}
                </li>
              )}
              {nextDungeon && (
                <li className="small muted next-line">
                  Next: <b>{nextDungeon.name}</b> ({nextDungeon.min}–{nextDungeon.max})
                </li>
              )}
            </FitList>
          </Panel>
        </div>
      </div>

      <Panel title="Coming up" icon="inv_misc_book_09">
        <FitList className="event-list compact" onMore={() => onTab('class')} moreLabel="Class skills">
          {coming.length ? (
            coming
          ) : (
            <li className="empty">{level >= MAX_LEVEL ? 'Level 60. Time for raids!' : 'Nothing new soon.'}</li>
          )}
        </FitList>
      </Panel>

      <Panel title="Where to quest" icon="inv_misc_map_01">
        <FitList className="zone-list" onMore={() => onTab('quests')} moreLabel="Quests & dungeons">
          {zoneList.length ? (
            zoneList.map((s) => <ZoneRow key={s.zone.id} s={s} character={character} compact />)
          ) : (
            <li className="empty">No zones found for this level yet.</li>
          )}
          {cityList.length > 0 && (
            <li className="coming-heading" data-fit-heading>
              Capital cities
            </li>
          )}
          {cityList.map((s) => (
            <CityRow key={s.city.id} s={s} />
          ))}
          {nextZones.length > 0 && (
            <li className="coming-heading" data-fit-heading>
              Next zones
            </li>
          )}
          {nextZones.map((s) => (
            <ZoneRow key={s.zone.id} s={s} character={character} compact />
          ))}
        </FitList>
      </Panel>

      <Panel title="Trade skills" icon="trade_blacksmithing">
        <FitList className="prof-list" onMore={() => onTab('trade')} moreLabel="Trade skills">
          {character.professions.length ? (
            character.professions.map((p) => (
              <ProfessionSummary key={p.id} entry={p} level={level} race={race} onSkill={(s) => onSkill(p.id, s)} />
            ))
          ) : (
            <li className="empty">No trade skills picked. Add them with Edit.</li>
          )}
        </FitList>
      </Panel>
    </div>
  );
}
