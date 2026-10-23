import { BETA_LEVEL_CAP, MAX_LEVEL } from '../../data';
import { eventsAt, nextTrainingLevel, type EventContext, type LevelEvent } from '../../lib/events';
import { professionIcon } from '../../lib/icons';
import { Badge, Empty, Icon, Panel, StatusMark, Tooltip } from '../ui';
import { SpellTip } from '../SpellTip';

function EventRow({ event, ctx }: { event: LevelEvent; ctx: EventContext }) {
  switch (event.kind) {
    case 'spell': {
      const { spell, rank, isNewSpell } = event.entry;
      const inSpec = spell.school === ctx.spec.school;
      return (
        <li className={`event event-spell ${inSpec ? 'is-spec' : ''}`}>
          <Tooltip content={<SpellTip spell={spell} rank={rank} note={spell.note} />}>
            <Icon icon={spell.icon} size={30} />
          </Tooltip>
          <div className="event-text">
            <span className="event-title">
              {spell.name}
              <StatusMark status={spell.status} />
            </span>
            <span className="event-sub">
              {isNewSpell ? 'New spell' : rank.rank ? `${rank.rank} upgrade` : 'Upgrade'} · {spell.school}
              {spell.passive && ' · Passive'}
            </span>
          </div>
          <span className="event-tags">
            {inSpec && <Badge title={`${ctx.spec.name} spell`}>Spec</Badge>}
            {spell.talent && <Badge tone="purple">Talent</Badge>}
            {spell.unconfirmed && (
              <Badge tone="grey" title="In the client tables but not seen on the beta yet">
                ?
              </Badge>
            )}
          </span>
        </li>
      );
    }
    case 'talent':
      return (
        <li className="event is-spec">
          <Icon icon={event.spell.icon} size={30} />
          <div className="event-text">
            <span className="event-title">{event.spell.name} talent</span>
            <span className="event-sub">Now available in your {ctx.spec.name} tree</span>
          </div>
          <Badge tone="purple">Talent</Badge>
        </li>
      );
    case 'equipment':
      return (
        <li className="event">
          <Icon icon={event.item.icon} size={30} />
          <div className="event-text">
            <span className="event-title">{event.item.name}</span>
            <span className="event-sub">You can now {event.item.name === 'Dual Wield' ? 'dual wield' : 'use this'}</span>
          </div>
          <Badge tone="green">Gear</Badge>
        </li>
      );
    case 'dungeon':
      return (
        <li className="event">
          <Icon icon="inv_misc_map_01" size={30} />
          <div className="event-text">
            <span className="event-title">
              {event.dungeon.name}
              {event.dungeon.isNew && <StatusMark status="new" />}
            </span>
            <span className="event-sub">
              Dungeon {event.dungeon.min}–{event.dungeon.max} · {event.dungeon.zone}
            </span>
          </div>
          <Badge tone="blue">Dungeon</Badge>
        </li>
      );
    case 'battleground':
      return (
        <li className="event">
          <Icon icon={ctx.race.faction === 'Alliance' ? 'inv_bannerpvp_02' : 'inv_bannerpvp_01'} size={30} />
          <div className="event-text">
            <span className="event-title">
              {event.bg.name}
              {event.bg.isNew && <StatusMark status="new" />}
            </span>
            <span className="event-sub">Battleground queue opens · {event.bg.size}</span>
          </div>
          <Badge tone="red">PvP</Badge>
        </li>
      );
    case 'profession':
      return (
        <li className="event">
          <Icon icon={professionIcon(event.profession.id)} size={30} />
          <div className="event-text">
            <span className="event-title">
              {event.rank.name} {event.profession.name}
            </span>
            <span className="event-sub">
              Trainable at skill {event.rank.minSkill}+ (raises cap to {event.rank.maxSkill})
              {!event.rank.confirmed && ' · level is the Classic value'}
            </span>
          </div>
          <Badge tone="green">Trade</Badge>
        </li>
      );
    case 'milestone':
      return (
        <li className="event">
          <Icon icon="achievement_level_10" size={30} />
          <div className="event-text">
            <span className="event-title">{event.milestone.title}</span>
            <span className="event-sub">{event.milestone.text}</span>
          </div>
          {!event.milestone.confirmed && (
            <Badge tone="grey" title={`Source: ${event.milestone.source}`}>
              Unconfirmed
            </Badge>
          )}
        </li>
      );
  }
}

function sortEvents(events: LevelEvent[], ctx: EventContext): LevelEvent[] {
  const weight = (e: LevelEvent) => {
    if (e.kind === 'spell') return e.entry.spell.school === ctx.spec.school ? 0 : e.entry.isNewSpell ? 1 : 2;
    if (e.kind === 'talent') return 0;
    return 3;
  };
  return [...events].sort((a, b) => weight(a) - weight(b));
}

export function ThisLevelPanel({ ctx }: { ctx: EventContext }) {
  const level = ctx.character.level;
  const events = sortEvents(eventsAt(ctx, level), ctx);
  const nextTraining = nextTrainingLevel(ctx, level);
  const talentPoints = Math.max(0, level - 9);

  return (
    <Panel title={`New at level ${level}`} icon="spell_holy_borrowedtime" className="panel-this-level">
      {level > BETA_LEVEL_CAP && (
        <p className="notice">
          The beta stopped at level {BETA_LEVEL_CAP}. Anything above it comes from the client data and nobody has
          played it yet, so expect changes at launch.
        </p>
      )}
      <div className="stat-row">
        <span>
          <b>{talentPoints}</b> talent point{talentPoints === 1 ? '' : 's'}
        </span>
        <span>
          {nextTraining ? (
            <>
              Next trainer visit: <b>level {nextTraining}</b>
            </>
          ) : (
            'Nothing left to train'
          )}
        </span>
      </div>
      {events.length ? (
        <ul className="event-list">
          {events.map((e, i) => (
            <EventRow key={i} event={e} ctx={ctx} />
          ))}
        </ul>
      ) : (
        <Empty>Nothing new at the trainer this level. Keep questing!</Empty>
      )}
    </Panel>
  );
}

const LOOKAHEAD = 6;

export function ComingUpPanel({ ctx }: { ctx: EventContext }) {
  const level = ctx.character.level;
  const levels = [];
  for (let l = level + 1; l <= Math.min(MAX_LEVEL, level + LOOKAHEAD); l++) {
    const events = sortEvents(eventsAt(ctx, l), ctx);
    if (events.length) levels.push({ level: l, events });
  }
  return (
    <Panel title="Coming up" icon="inv_misc_book_09" className="panel-coming-up">
      {levels.length ? (
        levels.map(({ level: l, events }) => (
          <div key={l} className="coming-level">
            <h3>
              Level {l}
              <span className="muted"> · in {l - level}</span>
            </h3>
            <ul className="event-list compact">
              {events.map((e, i) => (
                <EventRow key={i} event={e} ctx={ctx} />
              ))}
            </ul>
          </div>
        ))
      ) : (
        <Empty>{level >= MAX_LEVEL ? 'You made it to 60. Time for raids!' : 'Nothing new in the next few levels.'}</Empty>
      )}
    </Panel>
  );
}
