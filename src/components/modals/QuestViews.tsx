import { useState } from 'react';
import { classById, raceById, zoneById } from '../../data';
import { isDone, useDone } from '../../lib/done';
import { levelColor } from '../../lib/game';
import type { ChainStep, Faction, Quest, QuestBundle, QuestGiver } from '../../types';
import { Badge, ItemIcon, Money } from '../ui';
import { useModal } from './ModalContext';

/**
 * Shared state for the quest list and map: which quest the mouse is on, to light up its pins,
 * and which quests are picked out with a click, to show where to turn them in.
 */
export interface HoverProps {
  hovered?: number;
  onHover?: (questId: number | undefined) => void;
  selected?: ReadonlySet<number>;
  onSelect?: (questId: number) => void;
}

/** Hover and selection state for a quest view, to spread onto its list and map. */
export function useQuestFocus() {
  const [hovered, onHover] = useState<number>();
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const onSelect = (id: number) =>
    setSelected((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  return { hovered, onHover, selected, onSelect };
}

/** Toggle for showing the quests marked done, so they can be unmarked; nothing while there are none. */
export function ShowDone({
  count,
  show,
  onChange,
}: {
  count: number;
  show: boolean;
  onChange: (show: boolean) => void;
}) {
  if (!count && !show) return null;
  return (
    <label className="show-done small">
      <input type="checkbox" checked={show} onChange={(e) => onChange(e.target.checked)} />
      Show done <span className="tab-count">{count}</span>
    </label>
  );
}

function DoneButton({ questId, onToggle }: { questId: number; onToggle: () => void }) {
  const { done } = useDone();
  const marked = isDone(done, questId);
  return (
    <button
      type="button"
      className={`done-button ${marked ? 'is-done' : ''}`}
      aria-pressed={marked}
      title={marked ? 'Done: click to mark as not done' : 'Mark as done'}
      onClick={onToggle}
    >
      ✓
    </button>
  );
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
  selected,
  onSelect,
  stepLabel,
}: {
  quest: Quest;
  bundle: QuestBundle;
  level: number;
  here?: number;
  stepLabel?: string;
} & HoverProps) {
  const { done, toggle } = useDone();
  const color = levelColor(quest.level, level);
  const sameGiver =
    quest.end && quest.start && quest.end.name === quest.start.name && quest.end.zone === quest.start.zone;
  return (
    <article
      className={`quest-card d-border-${color} ${restrictedClass(quest)} ${hovered === quest.id ? 'is-hovered' : ''} ${selected?.has(quest.id) ? 'is-selected' : ''} ${isDone(done, quest.id) ? 'is-done' : ''} ${onSelect ? 'is-selectable' : ''}`}
      onMouseEnter={() => onHover?.(quest.id)}
      onMouseLeave={() => onHover?.(undefined)}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('button, a, input')) onSelect?.(quest.id);
      }}
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
        <DoneButton questId={quest.id} onToggle={() => toggle(quest)} />
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
  takeable,
  faction,
  hovered,
  onHover,
  selected,
  onSelect,
  title,
}: {
  chainId: string;
  bundle: QuestBundle;
  level: number;
  here?: number;
  /** Quest ids to show as full cards; other steps get a one-line summary. */
  visible: Set<number>;
  /** Quest ids in the bundle this character can take; the rest are left out of the chain. */
  takeable: Set<number>;
  /** The character's faction: steps elsewhere for the other faction are left out too. */
  faction?: Faction;
  title?: string;
} & HoverProps) {
  const { done } = useDone();
  const byId = new Map(bundle.quests.map((q) => [q.id, q]));
  // Steps this character can't take (another class's, race's or faction's version of a
  // step) are dropped; their steps in other zones stay as one-line summaries.
  const forOthers = (s: ChainStep) =>
    byId.has(s.id)
      ? !takeable.has(s.id)
      : !!faction && (s.side === 'Alliance' || s.side === 'Horde') && s.side !== faction;
  const steps = (bundle.chains[chainId] ?? [])
    .map((step) => step.filter((s) => !forOthers(s)))
    .filter((step) => step.length);
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
                  selected={selected}
                  onSelect={onSelect}
                  stepLabel={`${i + 1}.`}
                />
              ) : (
                <div key={s.id} className={`chain-step-line ${isDone(done, s.id) ? 'is-done' : ''}`}>
                  <span className="quest-step">{i + 1}.</span>
                  {isDone(done, s.id) && (
                    <span className="done-mark" title="Done">
                      ✓
                    </span>
                  )}
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
