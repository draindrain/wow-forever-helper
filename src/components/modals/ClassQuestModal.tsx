import { useState } from 'react';
import { isDone, useDone } from '../../lib/done';
import { questUnlockLevel } from '../../lib/game';
import type { Character, ClassMeta, QuestBundle, Race } from '../../types';
import { Badge } from '../ui';
import { Modal } from './Modal';
import { hideDone, QuestList, questsFor } from './QuestList';
import { QuestMap } from './QuestMap';
import { ShowDone, useQuestFocus } from './QuestViews';

/**
 * A class quest and the rest of its chain. Class quests often start in a capital city,
 * which has no zone page here, so they get their own view with the giver's map.
 */
export function ClassQuestModal({
  questId,
  bundle,
  character,
  race,
  cls,
  onClose,
}: {
  questId: number;
  bundle: QuestBundle;
  character: Character;
  race: Race;
  cls: ClassMeta;
  onClose: () => void;
}) {
  const [showDone, setShowDone] = useState(false);
  const focus = useQuestFocus();
  const { done } = useDone();
  const level = character.level;
  const quest = bundle.quests.find((q) => q.id === questId);
  const mine = questsFor(bundle.quests, race, cls);
  const chain = quest?.chain ? mine.filter((q) => q.chain?.id === quest.chain!.id) : quest ? [quest] : [];
  const shown = hideDone(chain, done, showDone);
  const doneCount = chain.filter((q) => isDone(done, q.id)).length;
  const mapZone = quest?.start?.zone;
  const unlock = quest && questUnlockLevel(quest);

  return (
    <Modal
      title={quest?.name ?? 'Class quest'}
      icon={`classicon_${cls.id}`}
      subtitle={
        <>
          <Badge tone="class">{cls.name} quest</Badge>
          {unlock !== undefined && <span className={unlock > level ? 'd-red' : 'muted'}>From level {unlock}</span>}
          {quest?.start?.zoneName && <span className="muted">{quest.start.zoneName}</span>}
        </>
      }
      onClose={onClose}
    >
      <div className="modal-split">
        <aside className="modal-side">
          {mapZone !== undefined ? (
            <QuestMap zoneId={mapZone} quests={hideDone(shown, done, false)} level={level} {...focus} />
          ) : (
            <p className="muted small">No map position for this quest's giver.</p>
          )}
        </aside>
        <section className="modal-main">
          {doneCount > 0 && (
            <div className="modal-toolbar">
              <ShowDone count={doneCount} show={showDone} onChange={setShowDone} />
            </div>
          )}
          <div className="modal-scroll">
            {shown.length ? (
              <QuestList
                quests={shown}
                takeable={mine}
                faction={race.faction}
                bundle={bundle}
                level={level}
                here={mapZone}
                {...focus}
              />
            ) : doneCount ? (
              <p className="muted">
                You've done this chain.{' '}
                <button type="button" className="link-button" onClick={() => setShowDone(true)}>
                  Show done
                </button>
              </p>
            ) : (
              <p className="muted">This quest isn't in the current data.</p>
            )}
          </div>
          <p className="source small muted">
            Quests, givers, map positions and rewards from Wowhead's Forever database; map © Blizzard via Wowhead.
          </p>
        </section>
      </div>
    </Modal>
  );
}
