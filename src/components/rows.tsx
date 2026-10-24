import type { LevelEvent, EventContext } from '../lib/events';
import {
  dungeonFit,
  learnSkill,
  recipeColor,
  talentState,
  type DungeonFit,
  type ZoneFit,
  type ZoneSuggestion,
} from '../lib/game';
import { professionIcon } from '../lib/icons';
import type { Character, Dungeon, Recipe, Spec, Spell, SpellRank } from '../types';
import { SpellTip } from './SpellTip';
import { Badge, Icon, LevelTrack, StatusMark, Tooltip } from './ui';

// ---------------------------------------------------------------- level events

export function EventRow({ event, ctx, compact }: { event: LevelEvent; ctx: EventContext; compact?: boolean }) {
  const size = compact ? 26 : 30;
  switch (event.kind) {
    case 'spell': {
      const { spell, rank, isNewSpell } = event.entry;
      const inSpec = spell.school === ctx.spec.school;
      return (
        <li className={`event ${inSpec ? 'is-spec' : ''}`}>
          <Tooltip content={<SpellTip spell={spell} rank={rank} note={spell.note} />}>
            <Icon icon={spell.icon} size={size} />
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
          <Icon icon={event.spell.icon} size={size} />
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
          <Icon icon={event.item.icon} size={size} />
          <div className="event-text">
            <span className="event-title">{event.item.name}</span>
            <span className="event-sub">
              You can now {event.item.name === 'Dual Wield' ? 'dual wield' : 'use this'}
            </span>
          </div>
          <Badge tone="green">Gear</Badge>
        </li>
      );
    case 'dungeon':
      return (
        <li className="event">
          <Icon icon="inv_misc_map_01" size={size} />
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
          <Icon icon={ctx.race.faction === 'Alliance' ? 'inv_bannerpvp_02' : 'inv_bannerpvp_01'} size={size} />
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
          <Icon icon={professionIcon(event.profession.id)} size={size} />
          <div className="event-text">
            <span className="event-title">
              {event.rank.name} {event.profession.name}
            </span>
            <span className="event-sub">
              Trainable at skill {event.rank.minSkill}+ (cap {event.rank.maxSkill})
              {!event.rank.confirmed && ' · Classic level'}
            </span>
          </div>
          <Badge tone="green">Trade</Badge>
        </li>
      );
    case 'milestone':
      return (
        <li className="event">
          <Icon icon="achievement_level_10" size={size} />
          <div className="event-text">
            <span className="event-title">{event.milestone.title}</span>
            <span className={`event-sub ${compact ? 'clamp-2' : ''}`}>{event.milestone.text}</span>
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

/** Spec spells first, then new spells, then upgrades, then everything else. */
export function sortEvents(events: LevelEvent[], ctx: EventContext): LevelEvent[] {
  const weight = (e: LevelEvent) => {
    if (e.kind === 'spell') return e.entry.spell.school === ctx.spec.school ? 0 : e.entry.isNewSpell ? 1 : 2;
    if (e.kind === 'talent') return 0;
    return 3;
  };
  return [...events].sort((a, b) => weight(a) - weight(b));
}

// ---------------------------------------------------------------- zones

const zoneFitLabel: Record<ZoneFit, string> = {
  ideal: 'Right level',
  early: 'A bit high',
  late: 'Wrapping up',
  other: 'Some quests',
  upcoming: 'Later',
};
const zoneFitTone: Record<ZoneFit, string> = {
  ideal: 'yellow',
  early: 'orange',
  late: 'green',
  other: 'grey',
  upcoming: 'red',
};

export function ZoneRow({ s, character, compact }: { s: ZoneSuggestion; character: Character; compact?: boolean }) {
  const level = character.level;
  const gathering = {
    herb: character.professions.find((p) => p.id === 'herbalism'),
    ore: character.professions.find((p) => p.id === 'mining'),
  };
  const nodes = s.zone.nodes.filter((n) => gathering[n.kind]);
  return (
    <li className={`zone fit-${s.fit} ${compact ? 'is-compact' : ''}`}>
      <div className="zone-head">
        <span className="zone-name">
          {s.zone.name}
          {s.zone.isNew && <StatusMark status="new" />}
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
        {!compact && (
          <span className={`territory territory-${s.zone.territory.toLowerCase()}`}>{s.zone.territory}</span>
        )}
        {!compact && <span className="muted">{s.zone.continent}</span>}
        {s.fit === 'upcoming' && !s.estimated && <span className="muted">{s.totalQuests} quests</span>}
        {s.fit !== 'upcoming' && !s.estimated && (
          <span>
            <span className="q-yellow">{s.goodQuests}</span> quests
            {s.greenQuests > 0 && (
              <>
                {' '}
                · <span className="q-green">{s.greenQuests}</span> easy
              </>
            )}
          </span>
        )}
        <span className="spacer" />
        {s.isStart && <Badge tone="blue">Start zone</Badge>}
        <Badge tone={zoneFitTone[s.fit]}>{zoneFitLabel[s.fit]}</Badge>
      </div>
      {!compact && s.zone.note && !s.estimated && <div className="zone-note small muted">{s.zone.note}</div>}
      {!compact && nodes.length > 0 && (
        <div className="node-row small">
          {nodes.map((n) => {
            const skill = gathering[n.kind]!.skill;
            return (
              <span
                key={n.name}
                className={`node node-${n.kind} ${n.skill > skill ? 'node-next' : ''}`}
                title={`Needs ${n.skill} skill`}
              >
                {n.name} <span className="muted">{n.skill}</span>
              </span>
            );
          })}
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------- dungeons

const dungeonFitLabel: Record<DungeonFit, string> = {
  locked: 'Can’t enter yet',
  hard: 'Challenging',
  ideal: 'Right level',
  easy: 'Easy',
  grey: 'Too low',
};
const dungeonFitTone: Record<DungeonFit, string> = {
  locked: 'red',
  hard: 'orange',
  ideal: 'yellow',
  easy: 'green',
  grey: 'grey',
};

export function DungeonRow({ d, level, compact }: { d: Dungeon; level: number; compact?: boolean }) {
  const fit = dungeonFit(d, level);
  return (
    <li className={`dungeon fit-${fit} ${compact ? 'is-compact' : ''}`}>
      <div className="zone-head">
        <span className="zone-name">
          {d.name}
          {d.isNew && <StatusMark status="new" />}
        </span>
        <span className="zone-range">
          {d.min}–{d.max}
        </span>
      </div>
      {!compact && <LevelTrack min={d.min} max={d.max} level={level} />}
      <div className="zone-meta">
        <span className="muted">{d.zone}</span>
        {!compact && <span className="muted">{d.players}-player</span>}
        {d.entryLevel && <span className="muted">Entry {d.entryLevel}+</span>}
        <span className="spacer" />
        <Badge tone={dungeonFitTone[fit]}>{dungeonFitLabel[fit]}</Badge>
      </div>
      {!compact &&
        (d.bosses.length > 0 ? (
          <div className="bosses small clamp-2">
            <span className="muted">Bosses: </span>
            {d.bosses.join(' · ')}
          </div>
        ) : (
          !d.inClient && <div className="small muted">Announced; not in the current client build.</div>
        ))}
    </li>
  );
}

// ---------------------------------------------------------------- spells

export function SpellRow({
  spell,
  current,
  next,
  spec,
}: {
  spell: Spell;
  current?: SpellRank;
  next?: SpellRank;
  spec: Spec;
}) {
  const talent = talentState(spell, spec);
  const rank = current ?? spell.ranks[0]!;
  return (
    <li className={`spell ${!current ? 'is-future' : ''} ${talent === 'other' ? 'is-dim' : ''}`}>
      <Tooltip content={<SpellTip spell={spell} rank={rank} note={spell.note} />}>
        <Icon icon={spell.icon} size={30} />
      </Tooltip>
      <div className="spell-text">
        <span className="spell-name">
          {spell.name}
          <StatusMark status={spell.status} />
        </span>
        <span className="spell-sub">
          {current ? (
            <>
              {current.rank ?? (spell.passive ? 'Passive' : 'Known')}
              {next && <span className="muted"> · next {next.level}</span>}
            </>
          ) : (
            <span className="muted">Learn at {rank.level}</span>
          )}
        </span>
      </div>
      {spell.talent && (
        <Badge tone="purple" title={`Rank 1 comes from the ${spell.talent.tree} talent tree`}>
          {talent === 'spec' ? 'Talent' : spell.talent.tree}
        </Badge>
      )}
    </li>
  );
}

// ---------------------------------------------------------------- recipes

export function RecipeTip({ recipe, skill }: { recipe: Recipe; skill: number }) {
  const learn = learnSkill(recipe);
  return (
    <>
      <div className="tt-head">
        <span className={`tt-name q${recipe.quality}`}>{recipe.name}</span>
      </div>
      <div className="tt-line tt-muted">{recipe.heading}</div>
      {recipe.reagents.length > 0 && (
        <div className="tt-line">
          Reagents: {recipe.reagents.map((r) => `${r.count > 1 ? `${r.count}× ` : ''}${r.name}`).join(', ')}
        </div>
      )}
      <div className="tt-line tt-bands">
        <span className="d-orange">Orange</span> to {Math.max(0, (recipe.yellow ?? 1) - 1)} ·{' '}
        <span className="d-yellow">Yellow</span> {recipe.yellow} · <span className="d-green">Green</span> {recipe.green}{' '}
        · <span className="d-grey">Grey</span> {recipe.grey}
      </div>
      <div className="tt-line tt-req">
        {recipe.source === 'item'
          ? `Learned from ${recipe.taughtBy ?? 'a recipe item'}${learn.known ? ` (skill ${learn.skill})` : ''}`
          : learn.known
            ? `Trainer, skill ${learn.skill}`
            : `Trainer. The skill it needs isn't in the client; usually about ${learn.skill}.`}
      </div>
      <div className={`tt-line d-${recipeColor(recipe, skill)}`}>
        At {skill}: {recipeColor(recipe, skill)}
      </div>
      {recipe.status !== 'unchanged' && (
        <div className={`tt-line tt-${recipe.status}`}>
          {recipe.status === 'new' ? 'New in Forever' : 'Changed from Classic'}
        </div>
      )}
    </>
  );
}

export function RecipeRow({ recipe, skill, upcoming }: { recipe: Recipe; skill: number; upcoming?: boolean }) {
  const color = recipeColor(recipe, skill);
  const learn = learnSkill(recipe);
  return (
    <li className="recipe">
      <Tooltip content={<RecipeTip recipe={recipe} skill={skill} />}>
        <Icon icon={recipe.icon} size={24} />
      </Tooltip>
      <div className="recipe-text">
        <span className={`recipe-name ${upcoming ? '' : `d-${color}`}`}>
          {recipe.name}
          <StatusMark status={recipe.status} />
        </span>
        <span className="recipe-sub">
          {recipe.reagents.map((r) => `${r.count}× ${r.name}`).join(', ') || recipe.heading}
        </span>
      </div>
      <span className="recipe-side">
        {upcoming ? (
          <span className="muted">
            at {learn.skill}
            {!learn.known && '~'}
          </span>
        ) : (
          recipe.source === 'item' && (
            <Badge tone="blue" title={recipe.taughtBy}>
              Recipe
            </Badge>
          )
        )}
        {recipe.heading === 'Camping' && <Badge tone="green">Camping</Badge>}
      </span>
    </li>
  );
}
