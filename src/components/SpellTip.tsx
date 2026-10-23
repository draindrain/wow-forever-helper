import type { Spell, SpellRank } from '../types';
import { statusText } from './ui';

export function SpellTip({ spell, rank, note }: { spell: Spell; rank: SpellRank; note?: string }) {
  return (
    <>
      <div className="tt-head">
        <span className="tt-name">{spell.name}</span>
        {rank.rank && <span className="tt-rank">{rank.rank}</span>}
      </div>
      {spell.passive && <div className="tt-line">Passive</div>}
      {rank.meta && <div className="tt-line">{rank.meta}</div>}
      <div className="tt-desc">{rank.desc}</div>
      <div className="tt-line tt-req">Requires level {rank.level}</div>
      {spell.talent && (
        <div className="tt-line tt-talent">
          Rank 1 is a {spell.talent.tree} talent (level {spell.talent.level}+)
        </div>
      )}
      {spell.status !== 'unchanged' && <div className={`tt-line tt-${spell.status}`}>{statusText(spell.status)}</div>}
      {spell.unconfirmed && <div className="tt-line tt-warn">In the client but not seen on the beta yet</div>}
      {note && <div className="tt-line tt-muted">{note}</div>}
    </>
  );
}
