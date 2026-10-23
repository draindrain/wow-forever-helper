import { classById, raceById } from '../data';
import type { Character } from '../types';

export function CharacterSwitcher({
  characters,
  active,
  onSelect,
  onNew,
  onEdit,
}: {
  characters: Character[];
  active: Character;
  onSelect: (id: string) => void;
  onNew: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="switcher">
      <label className="sr-only" htmlFor="character-select">
        Character
      </label>
      <select
        id="character-select"
        className={`select class-${active.classId}`}
        value={active.id}
        onChange={(e) => onSelect(e.target.value)}
      >
        {characters.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}: {c.level} {raceById(c.race)?.name} {classById(c.classId)?.name}
          </option>
        ))}
      </select>
      <button type="button" className="wow-button small secondary" onClick={onEdit}>
        Edit
      </button>
      <button type="button" className="wow-button small" onClick={onNew}>
        New
      </button>
    </div>
  );
}
