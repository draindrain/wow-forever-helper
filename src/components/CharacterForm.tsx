import { useEffect, useState, type FormEvent } from 'react';
import { classById, meta, raceById } from '../data';
import { clampLevel, clampSkill, newCharacterId } from '../lib/characters';
import type { Character, CharacterProfession } from '../types';
import { classIcon, factionIcon, professionIcon } from '../lib/icons';
import { Icon } from './ui';

const MAX_PRIMARY = 2;

interface Props {
  initial?: Character;
  onSave: (c: Character) => void;
  onCancel?: () => void;
  onDelete?: () => void;
}

export function CharacterForm({ initial, onSave, onCancel, onDelete }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [raceId, setRaceId] = useState(initial?.race ?? '');
  const [classId, setClassId] = useState(initial?.classId ?? '');
  const [specId, setSpecId] = useState(initial?.spec ?? '');
  const [level, setLevel] = useState(initial?.level ?? 1);
  const [professions, setProfessions] = useState<CharacterProfession[]>(initial?.professions ?? []);

  const race = raceById(raceId);
  const cls = classById(classId);

  // Changing race can rule out the chosen class; changing class resets the spec.
  useEffect(() => {
    if (race && classId && !race.classes.includes(classId)) setClassId('');
  }, [race, classId]);
  useEffect(() => {
    if (cls && !cls.specs.some((s) => s.id === specId)) setSpecId('');
  }, [cls, specId]);

  const primaryCount = professions.filter(
    (p) => meta.professions.find((m) => m.id === p.id)?.kind !== 'secondary',
  ).length;

  function toggleProfession(id: string, secondary: boolean) {
    setProfessions((list) => {
      if (list.some((p) => p.id === id)) return list.filter((p) => p.id !== id);
      if (!secondary && primaryCount >= MAX_PRIMARY) return list;
      return [...list, { id, skill: 1 }];
    });
  }

  const valid = race && cls && specId;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    onSave({
      id: initial?.id ?? newCharacterId(),
      name: name.trim() || `${race.name} ${cls.name}`,
      race: race.id,
      classId: cls.id,
      spec: specId,
      level: clampLevel(level),
      professions: professions.map((p) => ({
        ...p,
        skill: clampSkill(p.skill),
      })),
    });
  }

  const factions = ['Alliance', 'Horde'] as const;

  return (
    <form className="char-form" onSubmit={submit}>
      <div className="form-col">
        <fieldset>
          <legend>Name</legend>
          <input
            className="text-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Character name (optional)"
            maxLength={24}
          />
        </fieldset>

        <fieldset>
          <legend>Race</legend>
          <div className="faction-columns">
            {factions.map((faction) => (
              <div key={faction} className={`faction-column faction-${faction.toLowerCase()}`}>
                <h3>
                  <Icon icon={factionIcon(faction)} size={20} /> {faction}
                </h3>
                <div className="choice-grid">
                  {meta.races
                    .filter((r) => r.faction === faction)
                    .map((r) => (
                      <button
                        type="button"
                        key={r.id}
                        className={`choice ${raceId === r.id ? 'is-selected' : ''}`}
                        onClick={() => setRaceId(r.id)}
                        aria-pressed={raceId === r.id}
                      >
                        <Icon icon={r.icon} size={28} />
                        <span>{r.name}</span>
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset disabled={!race}>
          <legend>Class</legend>
          <div className="choice-grid choice-grid-wide">
            {meta.classes.map((c) => {
              const allowed = race?.classes.includes(c.id);
              const isNew = race?.newClasses.includes(c.id);
              return (
                <button
                  type="button"
                  key={c.id}
                  className={`choice class-${c.id} ${classId === c.id ? 'is-selected' : ''}`}
                  disabled={!allowed}
                  onClick={() => setClassId(c.id)}
                  aria-pressed={classId === c.id}
                  title={allowed ? undefined : `${race?.name ?? 'This race'} can't be a ${c.name}`}
                >
                  <Icon icon={classIcon(c.id)} size={28} />
                  <span className="class-color">{c.name}</span>
                  {isNew && (
                    <span className="choice-new" title="New race/class combination in Forever">
                      ★ New
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset disabled={!cls}>
          <legend>Specialization</legend>
          <div className="choice-grid">
            {(cls?.specs ?? []).map((s) => (
              <button
                type="button"
                key={s.id}
                className={`choice ${specId === s.id ? 'is-selected' : ''}`}
                onClick={() => setSpecId(s.id)}
                aria-pressed={specId === s.id}
              >
                <span>{s.name}</span>
                <small>{s.role}</small>
              </button>
            ))}
            {!cls && <span className="muted">Pick a class first.</span>}
          </div>
        </fieldset>
      </div>
      <div className="form-col">
        <fieldset>
          <legend>Trade skills</legend>
          <p className="muted small">
            Up to {MAX_PRIMARY} primary professions, plus any secondary skills. You can track skill points on the main
            page.
          </p>
          {(['primary', 'secondary'] as const).map((group) => (
            <div key={group} className="choice-grid choice-grid-wide prof-choices">
              {meta.professions
                .filter((p) => (group === 'secondary') === (p.kind === 'secondary'))
                .map((p) => {
                  const selected = professions.some((x) => x.id === p.id);
                  const blocked = group === 'primary' && !selected && primaryCount >= MAX_PRIMARY;
                  return (
                    <button
                      type="button"
                      key={p.id}
                      className={`choice ${selected ? 'is-selected' : ''}`}
                      disabled={blocked}
                      onClick={() => toggleProfession(p.id, group === 'secondary')}
                      aria-pressed={selected}
                    >
                      <Icon icon={professionIcon(p.id)} size={24} />
                      <span>{p.name}</span>
                    </button>
                  );
                })}
            </div>
          ))}
        </fieldset>

        <fieldset>
          <legend>Current level</legend>
          <input
            className="text-input level-input"
            type="number"
            min={1}
            max={60}
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
          />
        </fieldset>

        <div className="form-actions">
          {onDelete && (
            <button type="button" className="wow-button danger" onClick={onDelete}>
              Delete
            </button>
          )}
          <span className="spacer" />
          {onCancel && (
            <button type="button" className="wow-button secondary" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button type="submit" className="wow-button" disabled={!valid}>
            {initial ? 'Save' : 'Create character'}
          </button>
        </div>
      </div>
    </form>
  );
}
