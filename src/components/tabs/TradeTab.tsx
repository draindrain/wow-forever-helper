import { favorCamp, ProfessionPanel } from '../ProfessionCard';
import { Empty, Panel } from '../ui';
import type { TabProps } from './types';

export function TradeTab({ character, race, onSkill }: TabProps) {
  const count = character.professions.length;
  if (!count) {
    return (
      <div className="tab-grid tab-trade" style={{ ['--profs' as string]: 1 }}>
        <Panel title="Trade skills" icon="trade_blacksmithing">
          <Empty>No trade skills picked. Use Edit at the top to add some.</Empty>
        </Panel>
      </div>
    );
  }
  return (
    <div className="tab-trade-wrap">
      <div className="tab-grid tab-trade" style={{ ['--profs' as string]: count }}>
        {character.professions.map((p) => (
          <ProfessionPanel key={p.id} entry={p} level={character.level} race={race} onSkill={(s) => onSkill(p.id, s)} />
        ))}
      </div>
      <p className="trade-footnote small muted">
        Recipe colours come from the Forever client; trainers keep their skill requirements on the server, so "~" marks
        an estimate. Fill loot crates and turn them in at {favorCamp[race.faction]} for reputation and Merchant's Favor,
        which buys many of the new recipes.
      </p>
    </div>
  );
}
