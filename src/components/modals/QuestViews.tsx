import { classById, raceById, zoneById } from '../../data';
import { levelColor } from '../../lib/game';
import type { ChainStep, Quest, QuestBundle, QuestGiver } from '../../types';
import { Badge, ItemIcon, Money } from '../ui';
import { useModal } from './ModalContext';

/** Shared state for the quest list: which quest the mouse is on, to light up its pins. */
export interface HoverProps {
  hovered?: number;
  onHover?: (questId: number | undefined) => void;
}

/** Marks class quests (and race-only ones) so they stand out among a zone's quests. */
export const restrictedClass = (q: Quest) => (q.classes ? 'is-class' : q.races ? 'is-race' : '');

const coordText = (g: QuestGiver) => (g.coord ? `${g.coord[0].toFixed(1)}, ${g.coord[1].toFixed(1)}` : '');

/** "! Marshal Dughan · 42.2, 65.8", naming the zone when it isn't the one being shown. */
function GiverLine({ giver, kind, here }: { giver: QuestGiver; kind: 'start' | 'end'; here?: number }) {
  const { openZone } = useModal();
  const elsewhere = giver.zone !== undefined && giver.zone !== here;
  const knownZone = elsewhere && giver.zone !== undefined && zoneById(giver.zone);
  return (
    <div className={`giver giver-${kind}`}>
      <span className="giver-mark" aria-hidden="true">
        {kind === 'start' ? '!' : '?'}
      </span>
      <span className="giver-label">{kind === 'start' ? 'Pick up' : 'Turn in'}</span>
      <span className="giver-name">
        {giver.kind === 'item' ? `Item: ${giver.name}` : giver.name}
        {giver.kind === 'object' && <span className="muted"> (object)</span>}
      </span>
      {(giver.coord || elsewhere) && (
        <span className="giver-where">
          {elsewhere &&
            (knownZone ? (
              <button type="button" className="link-button" onClick={() => openZone(giver.zone!)}>
                {giver.zoneName}
              </button>
            ) : (
              <span>{giver.zoneName}</span>
            ))}{' '}
          {giver.coord && <span className="muted">{coordText(giver)}</span>}
        </span>
      )}
    </div>
  );
}

export function Rewards({ quest, bundle }: { quest: Quest; bundle: QuestBundle }) {
  const r = quest.rewards;
  const item = (id: number) => bundle.items[String(id)];
  const has = r.xp || r.money || r.rep.length || r.items.length || r.choices.length;
  if (!has) return null;
  return (
    <div className="rewards">
      {(r.xp || r.money || r.rep.length > 0) && (
        <div className="reward-line">
          {r.xp ? <span className="reward-xp">{r.xp.toLocaleString()} XP</span> : null}
          {r.money ? <Money copper={r.money} /> : null}
          {r.rep.map(([faction, amount]) => (
            <span key={faction} className="reward-rep">
              {amount > 0 ? '+' : ''}
              {amount} {faction}
            </span>
          ))}
        </div>
      )}
      {r.items.length > 0 && (
        <div className="reward-items">
          <span className="muted small">You get</span>
          {r.items.map(([id, count]) => item(id) && <ItemIcon key={id} item={item(id)!} count={count} />)}
        </div>
      )}
      {r.choices.length > 0 && (
        <div className="reward-items">
          <span className="muted small">Choose one</span>
          {r.choices.map(([id, count]) => item(id) && <ItemIcon key={id} item={item(id)!} count={count} />)}
        </div>
      )}
    </div>
  );
}

export function QuestCard({
  quest,
  bundle,
  level,
  here,
  hovered,
  onHover,
  stepLabel,
}: {
  quest: Quest;
  bundle: QuestBundle;
  level: number;
  here?: number;
  stepLabel?: string;
} & HoverProps) {
  const color = levelColor(quest.level, level);
  const sameGiver =
    quest.end && quest.start && quest.end.name === quest.start.name && quest.end.zone === quest.start.zone;
  return (
    <article
      className={`quest-card d-border-${color} ${restrictedClass(quest)} ${hovered === quest.id ? 'is-hovered' : ''}`}
      onMouseEnter={() => onHover?.(quest.id)}
      onMouseLeave={() => onHover?.(undefined)}
    >
      <header className="quest-head">
        <span className={`quest-level d-${color}`} title={`Quest level ${quest.level}`}>
          {quest.level}
        </span>
        <span className="quest-name">
          {stepLabel && <span className="quest-step">{stepLabel}</span>}
          {quest.name}
        </span>
        <span className="quest-tags">
          {quest.type && <Badge tone="orange">{quest.type}</Badge>}
          {quest.classes && (
            <Badge tone="class">{quest.classes.map((id) => classById(id)?.name ?? id).join(' / ')}</Badge>
          )}
          {quest.races && <Badge tone="blue">{quest.races.map((id) => raceById(id)?.name ?? id).join(' / ')}</Badge>}
        </span>
      </header>
      {quest.reqLevel !== undefined && quest.reqLevel > 1 && quest.reqLevel > level && (
        <div className="small d-red">Requires level {quest.reqLevel}</div>
      )}
      {quest.summary && <p className="quest-summary">{quest.summary}</p>}
      {quest.start && <GiverLine giver={quest.start} kind="start" here={here} />}
      {quest.end && !sameGiver && <GiverLine giver={quest.end} kind="end" here={here} />}
      {sameGiver && <div className="small muted giver-same">Turn in to the same person.</div>}
      <Rewards quest={quest} bundle={bundle} />
    </article>
  );
}

/** A quest chain: every step in order, with full cards for the steps in this bundle. */
export function ChainCard({
  chainId,
  bundle,
  level,
  here,
  visible,
  hovered,
  onHover,
  title,
}: {
  chainId: string;
  bundle: QuestBundle;
  level: number;
  here?: number;
  /** Quest ids to show as full cards; other steps get a one-line summary. */
  visible: Set<number>;
  title?: string;
} & HoverProps) {
  const steps = bundle.chains[chainId] ?? [];
  const byId = new Map(bundle.quests.map((q) => [q.id, q]));
  return (
    <section className="chain-card">
      <header className="chain-head">
        <span className="chain-icon" aria-hidden="true">
          ⛓
        </span>
        <span className="chain-title">{title ?? steps[0]?.[0]?.name ?? 'Quest chain'}</span>
        <span className="muted small">{steps.length} steps</span>
      </header>
      <ol className="chain-steps">
        {steps.map((step, i) => (
          <li key={i}>
            {step.map((s: ChainStep) => {
              const q = byId.get(s.id);
              return q && visible.has(q.id) ? (
                <QuestCard
                  key={s.id}
                  quest={q}
                  bundle={bundle}
                  level={level}
                  here={here}
                  hovered={hovered}
                  onHover={onHover}
                  stepLabel={`${i + 1}.`}
                />
              ) : (
                <div key={s.id} className="chain-step-line">
                  <span className="quest-step">{i + 1}.</span>
                  {s.level !== undefined && (
                    <span className={`quest-level small d-${levelColor(s.level, level)}`}>{s.level}</span>
                  )}
                  <span>{s.name}</span>
                  {s.zone && <span className="muted small"> · {s.zone}</span>}
                </div>
              );
            })}
          </li>
        ))}
      </ol>
    </section>
  );
}
