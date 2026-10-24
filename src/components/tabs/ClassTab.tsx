import { MAX_LEVEL } from '../../data';
import { eventsAt, type EventContext } from '../../lib/events';
import { learnableSpells, ranksAt, specTalentSpells, spellbook, talentState } from '../../lib/game';
import type { Spell } from '../../types';
import { FitList } from '../FitList';
import { EventRow, SpellRow } from '../rows';
import { Badge, Icon, Panel, stackShare, Tooltip } from '../ui';
import { NewAtLevel } from './OverviewTab';
import type { TabProps } from './types';

const LOOKAHEAD = 12;

/** Spellbook rows for some spells: known first, then still to come; other trees' talent spells last. */
function SpellRows({ ctx, spells }: { ctx: EventContext; spells: Spell[] }) {
  const firstLevel = (s: Spell) => s.talent?.level ?? s.ranks[0]?.level ?? 0;
  const rows = spellbook(spells, ctx.character.level)
    .map((entry) => ({ ...entry, offSpec: talentState(entry.spell, ctx.spec) === 'other' }))
    .sort(
      (a, b) =>
        Number(a.offSpec) - Number(b.offSpec) ||
        Number(!a.current) - Number(!b.current) ||
        firstLevel(a.spell) - firstLevel(b.spell),
    );
  return (
    <>
      {rows.map((r) => (
        <SpellRow key={r.spell.name} spell={r.spell} current={r.current} next={r.next} spec={ctx.spec} />
      ))}
    </>
  );
}

function SchoolPanel({ ctx, school, spells }: { ctx: EventContext; school: string; spells: Spell[] }) {
  const isSpec = school === ctx.spec.school;
  const known = spells.filter(
    (s) => talentState(s, ctx.spec) !== 'other' && s.ranks.some((r) => r.level <= ctx.character.level),
  ).length;
  return (
    <Panel
      title={
        <>
          {isSpec && <span aria-label="Your spec">★ </span>}
          {school}
          <span className="title-count">{known}</span>
        </>
      }
      className={`school-panel ${isSpec ? 'is-spec' : ''}`}
    >
      <FitList className="spell-list">
        <SpellRows ctx={ctx} spells={spells} />
      </FitList>
    </Panel>
  );
}

/** Upcoming trainer spells, grouped by level. */
function trainingRows(ctx: EventContext) {
  const level = ctx.character.level;
  const spells = learnableSpells(ctx.classData, ctx.race, ctx.race.faction).filter(
    (s) => talentState(s, ctx.spec) !== 'other',
  );
  const rows = [];
  for (let l = level + 1; l <= Math.min(MAX_LEVEL, level + LOOKAHEAD); l++) {
    const entries = ranksAt(spells, l);
    if (!entries.length) continue;
    rows.push(
      <li key={`h${l}`} className="coming-heading" data-fit-heading>
        Level {l} <span className="muted">· in {l - level}</span>
      </li>,
      ...entries.map((entry, i) => <EventRow key={`${l}-${i}`} event={{ kind: 'spell', entry }} ctx={ctx} compact />),
    );
  }
  return rows;
}

/** Racials, spellbook schools that aren't talent trees, talents and gear. */
function MorePanel({ ctx, extraSchools }: { ctx: EventContext; extraSchools: { school: string; spells: Spell[] }[] }) {
  const level = ctx.character.level;
  const talents = specTalentSpells(learnableSpells(ctx.classData, ctx.race, ctx.race.faction), ctx.spec);
  const gear = ctx.classData.equipment.filter((e) => e.level > 1);
  const talentPoints = Math.max(0, level - 9);
  return (
    <Panel title="Racials, talents & gear" icon={ctx.race.icon}>
      <FitList className="spell-list">
        <li className="coming-heading" data-fit-heading>
          {ctx.race.name} racials
        </li>
        {ctx.race.racials.map((r) => (
          <li key={r.name} className="spell">
            <Tooltip
              content={
                <>
                  <div className="tt-head">
                    <span className="tt-name">{r.name}</span>
                  </div>
                  {r.passive && <div className="tt-line">Passive</div>}
                  {r.meta && <div className="tt-line">{r.meta}</div>}
                  <div className="tt-desc">{r.desc}</div>
                </>
              }
            >
              <Icon icon={r.icon} size={30} />
            </Tooltip>
            <div className="spell-text">
              <span className="spell-name">{r.name}</span>
              <span className="spell-sub clamp-1">{r.passive ? r.desc : (r.meta ?? 'Racial')}</span>
            </div>
          </li>
        ))}
        {extraSchools.flatMap(({ school, spells }) => [
          <li key={`h-${school}`} className="coming-heading" data-fit-heading>
            {school}
          </li>,
          <SpellRows key={school} ctx={ctx} spells={spells} />,
        ])}
        <li className="coming-heading" data-fit-heading>
          Talents · {talentPoints} point{talentPoints === 1 ? '' : 's'}
        </li>
        <li className="spell">
          <Icon icon="ability_marksmanship" size={30} />
          <div className="spell-text">
            <span className="spell-name">Dual specialization</span>
            <span className="spell-sub">
              {level >= 40 ? 'Available: 10 gold at your trainer' : 'Level 40 · 10 gold'}
            </span>
          </div>
        </li>
        {talents.map(({ spell, level: at }) => (
          <li key={spell.name} className={`spell ${at > level ? 'is-future' : ''}`}>
            <Icon icon={spell.icon} size={30} />
            <div className="spell-text">
              <span className="spell-name">{spell.name}</span>
              <span className="spell-sub">
                {ctx.spec.name} talent · {at > level ? `from level ${at}` : 'available'}
              </span>
            </div>
            <Badge tone="purple">Talent</Badge>
          </li>
        ))}
        {gear.length > 0 && (
          <li className="coming-heading" data-fit-heading>
            Gear
          </li>
        )}
        {gear.map((g) => (
          <li key={g.name} className={`spell ${g.level > level ? 'is-future' : ''}`}>
            <Icon icon={g.icon} size={30} />
            <div className="spell-text">
              <span className="spell-name">{g.name}</span>
              <span className="spell-sub">{g.level > level ? `From level ${g.level}` : `Since level ${g.level}`}</span>
            </div>
          </li>
        ))}
      </FitList>
    </Panel>
  );
}

export function ClassTab({ ctx, cls }: TabProps) {
  if (!ctx) return <p className="muted loading">Loading spellbook…</p>;
  const spells = learnableSpells(ctx.classData, ctx.race, ctx.race.faction);
  // Talent-tree schools get a column each (yours first); the rest (Poisons, Explorer Imp…) go in the last column.
  const treeSchools = cls.specs.map((s) => s.school);
  const columns = [ctx.spec.school, ...treeSchools.filter((s) => s !== ctx.spec.school)];
  const extraSchools = ctx.classData.schools
    .filter((s) => !treeSchools.includes(s))
    .map((school) => ({
      school,
      spells: spells.filter((s) => s.school === school),
    }))
    .filter((x) => x.spells.length > 0);

  // Share the first column between "new" and "next" by how much each has to show.
  const newCount = eventsAt(ctx, ctx.character.level).length;
  const plan = trainingRows(ctx);
  return (
    <div className="tab-grid tab-class" style={{ ['--schools' as string]: columns.length }}>
      <div className="stack">
        <div
          className="stack-item"
          // Never smaller than its title, stats and one row (plus the past-30 notice).
          style={stackShare(Math.max(newCount, 1) + 3, ctx.character.level > 30 ? 200 : 170)}
        >
          <NewAtLevel ctx={ctx} />
        </div>
        {plan.length > 0 && (
          <div className="stack-item" style={stackShare(plan.length + 1)}>
            <Panel title="Next trainer visits" icon="inv_misc_book_09">
              <FitList className="event-list compact">{plan}</FitList>
            </Panel>
          </div>
        )}
      </div>
      {columns.map((school) => (
        <SchoolPanel key={school} ctx={ctx} school={school} spells={spells.filter((s) => s.school === school)} />
      ))}
      <MorePanel ctx={ctx} extraSchools={extraSchools} />
    </div>
  );
}
