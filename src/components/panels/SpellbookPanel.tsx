import { useState } from 'react';
import { learnableSpells, spellbook, talentState } from '../../lib/game';
import type { EventContext } from '../../lib/events';
import { Badge, Empty, Icon, Panel, StatusMark, Tooltip } from '../ui';
import { SpellTip } from '../SpellTip';

const RACIALS = 'Racials';

export function SpellbookPanel({ ctx }: { ctx: EventContext }) {
  const { classData, race, spec, character } = ctx;
  // Your spec's school first, then the rest in spellbook order.
  const schools = [spec.school, ...classData.schools.filter((s) => s !== spec.school), RACIALS];
  const [tab, setTab] = useState(spec.school);
  const active = schools.includes(tab) ? tab : spec.school;
  const book = spellbook(learnableSpells(classData, race, race.faction), character.level);
  const inTab = book.filter((e) => e.spell.school === active);

  return (
    <Panel title="Spellbook" icon="inv_misc_book_09" className="panel-spellbook">
      <div className="tabs" role="tablist">
        {schools.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={active === s}
            className={`tab ${active === s ? 'is-active' : ''} ${s === spec.school ? 'is-spec' : ''}`}
            onClick={() => setTab(s)}
          >
            {s === spec.school && <span aria-hidden="true">★ </span>}
            {s}
            {s !== RACIALS && <span className="tab-count">{book.filter((e) => e.spell.school === s).length}</span>}
          </button>
        ))}
      </div>

      {active === RACIALS ? (
        <ul className="spell-grid">
          {race.racials.map((r) => (
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
                <Icon icon={r.icon} size={36} />
              </Tooltip>
              <div className="spell-text">
                <span className="spell-name">{r.name}</span>
                <span className="spell-sub">{r.passive ? 'Passive' : r.meta ?? 'Racial'}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : inTab.length ? (
        <ul className="spell-grid">
          {inTab.map(({ spell, current, next }) => {
            const talent = talentState(spell, spec);
            return (
              <li key={spell.name} className={`spell ${talent === 'other' ? 'is-dim' : ''}`}>
                <Tooltip content={<SpellTip spell={spell} rank={current!} note={spell.note} />}>
                  <Icon icon={spell.icon} size={36} />
                </Tooltip>
                <div className="spell-text">
                  <span className="spell-name">
                    {spell.name}
                    <StatusMark status={spell.status} />
                  </span>
                  <span className="spell-sub">
                    {current?.rank ?? (spell.passive ? 'Passive' : '')}
                    {next && <span className="muted"> · next at {next.level}</span>}
                  </span>
                </div>
                {spell.talent && (
                  <Badge tone="purple" title={`Rank 1 comes from the ${spell.talent.tree} talent tree`}>
                    {talent === 'spec' ? 'Talent' : `${spell.talent.tree} talent`}
                  </Badge>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>No {active} spells yet at level {character.level}.</Empty>
      )}
      <p className="source small muted">Trainer spells from the Forever client. ★ new in Forever, ◆ changed from Classic.</p>
    </Panel>
  );
}
