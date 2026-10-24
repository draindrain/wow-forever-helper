import { useState } from 'react';
import { instances, loadDungeonQuests } from '../../data';
import { dungeonFit } from '../../lib/game';
import { useAsync } from '../../lib/useAsync';
import type { Attunement, Character, ClassMeta, QuestBundle, Race } from '../../types';
import { Badge, StatusMark } from '../ui';
import { BossMap } from './BossMap';
import { Modal } from './Modal';
import { QuestList, questsFor } from './QuestList';
import { QuestCard, type HoverProps } from './QuestViews';

function AttunementCard({
  attunement,
  bundle,
  level,
  hovered,
  onHover,
  here,
}: { attunement: Attunement; bundle: QuestBundle; level: number; here?: number } & HoverProps) {
  const byId = new Map(bundle.quests.map((q) => [q.id, q]));
  return (
    <section className="chain-card attunement">
      <header className="chain-head">
        <span className="chain-icon" aria-hidden="true">
          🗝
        </span>
        <span className="chain-title">{attunement.title}</span>
        {attunement.optional ? <Badge tone="grey">Optional</Badge> : <Badge tone="orange">Required</Badge>}
        <span className="muted small">{attunement.quests.length} steps</span>
      </header>
      <ol className="chain-steps">
        {attunement.quests.map(
          (step, i) =>
            step.some((id) => byId.has(id)) && (
              <li key={i}>
                {step.map((id) => {
                  const q = byId.get(id);
                  return q ? (
                    <QuestCard
                      key={id}
                      quest={q}
                      bundle={bundle}
                      level={level}
                      hovered={hovered}
                      onHover={onHover}
                      here={here}
                      stepLabel={`${i + 1}.`}
                    />
                  ) : null;
                })}
              </li>
            ),
        )}
      </ol>
    </section>
  );
}

const SHARED_WINGS = /^(sm|dm)-/;

export function DungeonModal({
  dungeonId,
  character,
  race,
  cls,
  onClose,
}: {
  dungeonId: string;
  character: Character;
  race: Race;
  cls: ClassMeta;
  onClose: () => void;
}) {
  const dungeon = instances.dungeons.find((d) => d.id === dungeonId);
  const raid = instances.raids.find((r) => r.id === dungeonId);
  const bundle = useAsync(`dungeon-quests:${dungeonId}`, () => loadDungeonQuests(dungeonId));
  const [hovered, setHovered] = useState<number>();
  const level = character.level;

  const attunements = (bundle?.attunements ?? []).filter((a) => !a.faction || a.faction === race.faction);
  const attunementIds = new Set((bundle?.attunements ?? []).flatMap((a) => a.quests.flat()));
  const quests = bundle ? questsFor(bundle.quests, race, cls).filter((q) => !attunementIds.has(q.id)) : [];
  const fit = dungeon ? dungeonFit(dungeon, level) : undefined;

  return (
    <Modal
      title={dungeon?.name ?? raid?.name ?? 'Instance'}
      icon="inv_misc_head_dragon_black"
      subtitle={
        <>
          {dungeon && (
            <span className="zone-range">
              {dungeon.min}–{dungeon.max}
            </span>
          )}
          {raid && <span className="zone-range">Level 60 raid</span>}
          <span className="muted">{dungeon?.zone ?? raid?.zone}</span>
          {(dungeon?.isNew || raid?.isNew) && <StatusMark status="new" />}
        </>
      }
      onClose={onClose}
    >
      <div className="modal-split">
        <aside className="modal-side">
          <dl className="facts">
            {dungeon && (
              <>
                <dt>Group</dt>
                <dd>{dungeon.players} players</dd>
                {dungeon.entryLevel && (
                  <>
                    <dt>Entry</dt>
                    <dd>Level {dungeon.entryLevel}+</dd>
                  </>
                )}
                <dt>For you</dt>
                <dd className={`fit-text fit-${fit}`}>
                  {fit === 'locked'
                    ? "Can't enter yet"
                    : fit === 'hard'
                      ? 'Challenging'
                      : fit === 'ideal'
                        ? 'Right level'
                        : fit === 'easy'
                          ? 'Easy'
                          : 'Too low'}
                </dd>
              </>
            )}
            {raid && (
              <>
                <dt>Raid size</dt>
                <dd>{raid.size} players</dd>
                <dt>Opens</dt>
                <dd>9 December 2026</dd>
              </>
            )}
          </dl>
          <BossMap
            zoneId={bundle?.mapZone}
            bosses={dungeon?.bosses ?? []}
            pins={bundle?.bosses}
            crop={bundle?.mapCrop}
          />
          {dungeon && !dungeon.inClient && (
            <p className="small muted">Announced by Blizzard; not in the current client build yet.</p>
          )}
        </aside>
        <section className="modal-main">
          <div className="modal-scroll">
            {!bundle ? (
              <p className="muted">{bundle === null ? 'No quest data for this instance yet.' : 'Loading quests…'}</p>
            ) : (
              <>
                <h3 className="modal-section">Attunement & keys</h3>
                {attunements.length ? (
                  <div className="quest-columns">
                    {attunements.map((a) => (
                      <AttunementCard
                        key={a.title + (a.faction ?? '')}
                        attunement={a}
                        bundle={bundle}
                        level={level}
                        here={bundle.mapZone}
                        hovered={hovered}
                        onHover={setHovered}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="muted small">No attunement or key quest needed.</p>
                )}
                <h3 className="modal-section">
                  Quests {SHARED_WINGS.test(dungeonId) && <span className="muted small">· shared by all wings</span>}
                </h3>
                {quests.length ? (
                  <QuestList
                    quests={quests}
                    bundle={bundle}
                    level={level}
                    here={bundle.mapZone}
                    hovered={hovered}
                    onHover={setHovered}
                  />
                ) : (
                  <p className="muted small">No {race.faction} quests known for this instance yet.</p>
                )}
              </>
            )}
          </div>
          <p className="source small muted">
            Quests and rewards from Wowhead's Forever database. Attunements follow Classic, kept only if their quests
            are in Forever's data; a chain shows the steps Wowhead groups with its final quest, so a long one (Onyxia)
            starts earlier than listed.
          </p>
        </section>
      </div>
    </Modal>
  );
}
