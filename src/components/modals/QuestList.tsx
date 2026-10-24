import type { ClassMeta, Quest, QuestBundle, Race } from '../../types';
import { ChainCard, QuestCard, type HoverProps } from './QuestViews';

/**
 * Quests laid out in columns: each chain as one card with its steps in order,
 * standalone quests as their own cards, all sorted by level.
 */
export function QuestList({
  quests,
  bundle,
  level,
  here,
  hovered,
  onHover,
}: { quests: Quest[]; bundle: QuestBundle; level: number; here?: number } & HoverProps) {
  const visible = new Set(quests.map((q) => q.id));
  const groups: { key: string; level: number; chain?: string; quest?: Quest }[] = [];
  const chainsSeen = new Set<string>();
  for (const q of quests) {
    if (q.chain && bundle.chains[q.chain.id]) {
      if (chainsSeen.has(q.chain.id)) continue;
      chainsSeen.add(q.chain.id);
      groups.push({ key: `c${q.chain.id}`, level: q.level, chain: q.chain.id });
    } else {
      groups.push({ key: `q${q.id}`, level: q.level, quest: q });
    }
  }
  groups.sort((a, b) => a.level - b.level);
  return (
    <div className="quest-columns">
      {groups.map((g) =>
        g.chain ? (
          <ChainCard
            key={g.key}
            chainId={g.chain}
            bundle={bundle}
            level={level}
            here={here}
            visible={visible}
            hovered={hovered}
            onHover={onHover}
          />
        ) : (
          <QuestCard
            key={g.key}
            quest={g.quest!}
            bundle={bundle}
            level={level}
            here={here}
            hovered={hovered}
            onHover={onHover}
          />
        ),
      )}
    </div>
  );
}

/** Quests this character can take: their faction's (or both) and, for class or race quests, theirs. */
export function questsFor(quests: Quest[], race: Race, cls: ClassMeta) {
  return quests.filter(
    (q) =>
      (q.side === 'Both' || q.side === race.faction) &&
      (!q.classes || q.classes.includes(cls.id)) &&
      (!q.races || q.races.includes(race.id)),
  );
}
