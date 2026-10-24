import { loadRecipes, meta, professionById, zones } from '../data';
import { clampSkill } from '../lib/characters';
import {
  allNodes,
  maxSkinLevel,
  rankStatus,
  skillToSkin,
  skillUpRecipes,
  suggestZones,
  upcomingRecipes,
  type RankStatus,
} from '../lib/game';
import { professionIcon } from '../lib/icons';
import { useAsync } from '../lib/useAsync';
import type { CharacterProfession, Faction, GatherNode, Race, Recipe } from '../types';
import { FitList } from './FitList';
import { clickable, useModal } from './modals/ModalContext';
import { RecipeRow } from './rows';
import { Empty, Icon, Panel } from './ui';

// Professions you level by gathering or catching, not by crafting.
const SKILL_FROM_GATHERING: Record<string, string> = {
  herbalism: 'picking herbs',
  mining: 'mining veins',
  fishing: 'catching fish',
};
const NODE_KIND: Record<string, GatherNode['kind']> = { herbalism: 'herb', mining: 'ore' };

export const favorCamp: Record<Faction, string> = {
  Alliance: 'the Azeroth Commerce Authority camp at Three Corners in Redridge',
  Horde: 'the Durotar Supply and Logistics camp west of the Crossroads',
};

interface CardProps {
  entry: CharacterProfession;
  level: number;
  race: Race;
  onSkill: (skill: number) => void;
}

function useRecipes(professionId: string, faction: Faction): Recipe[] | undefined {
  const loaded = useAsync(`recipes:${professionId}`, () => loadRecipes(professionId));
  return loaded?.filter((r) => !r.faction || r.faction === faction);
}

function SkillControl({
  skill,
  name,
  onSkill,
  big,
}: {
  skill: number;
  name: string;
  onSkill: (s: number) => void;
  big?: boolean;
}) {
  const step = (n: number) => onSkill(clampSkill(skill + n));
  return (
    <div className="skill-control">
      {big && (
        <button type="button" onClick={() => step(-5)} aria-label="Minus 5">
          −5
        </button>
      )}
      <button type="button" onClick={() => step(-1)} aria-label="Minus 1">
        −
      </button>
      <input
        type="number"
        min={1}
        max={300}
        value={skill}
        aria-label={`${name} skill`}
        onChange={(e) => onSkill(clampSkill(Number(e.target.value) || 1))}
      />
      <button type="button" onClick={() => step(1)} aria-label="Plus 1">
        +
      </button>
      {big && (
        <button type="button" onClick={() => step(5)} aria-label="Plus 5">
          +5
        </button>
      )}
    </div>
  );
}

function SkillBar({ skill, status }: { skill: number; status: RankStatus }) {
  const max = status.current.maxSkill;
  return (
    <div className="skill-bar" aria-hidden="true">
      <span style={{ width: `${(Math.min(skill, max) / max) * 100}%` }} />
      <em>
        {status.current.name} · {skill} / {max}
      </em>
    </div>
  );
}

function RankCallout({ skill, status }: { skill: number; status: RankStatus }) {
  const next = status.next;
  if (!next) return null;
  if (skill < next.minSkill) {
    return (
      <p className="rank-note small muted">
        {next.name} at skill {next.minSkill}, level {next.level}
        {!next.confirmed && ' (Classic value)'}
      </p>
    );
  }
  return (
    <p className={`rank-callout ${status.canTrainNext ? 'is-ready' : ''}`}>
      {status.canTrainNext ? (
        <>
          <b>Train {next.name}</b> (cap {next.maxSkill}){!next.confirmed && ' · level unconfirmed'}
        </>
      ) : (
        <>
          {next.name} unlocks at <b>level {next.level}</b>
          {!next.confirmed && ' (Classic value)'}
        </>
      )}
      {status.capped && ' · at cap, not gaining skill'}
    </p>
  );
}

function NodeChips({ nodes, skill }: { nodes: GatherNode[]; skill: number }) {
  return (
    <>
      {nodes.map((n) => (
        <span key={n.name} className={`node node-${n.kind} ${n.skill > skill ? 'node-next' : ''}`}>
          {n.name} <span className="muted">{n.skill}</span>
        </span>
      ))}
    </>
  );
}

/** One profession as a compact card for the Overview. */
export function ProfessionSummary({ entry, level, race, onSkill }: CardProps) {
  const profession = professionById(entry.id);
  const recipes = useRecipes(entry.id, race.faction);
  if (!profession) return null;
  const skill = entry.skill;
  const status = rankStatus(meta.professionRanks, skill, level);
  const kind = NODE_KIND[entry.id];

  let body;
  if (kind) {
    const nodes = allNodes(zones, kind);
    const can = nodes.filter((n) => n.skill <= skill).slice(-3);
    const next = nodes.find((n) => n.skill > skill);
    body = (
      <div className="node-row small">
        <NodeChips nodes={next ? [...can, next] : can} skill={skill} />
      </div>
    );
  } else if (entry.id === 'skinning') {
    body = (
      <p className="small prof-line">
        Skins beasts up to level <b>{maxSkinLevel(skill)}</b> · level {level} needs <b>{skillToSkin(level)}</b>
      </p>
    );
  } else if (recipes) {
    const now = skillUpRecipes(recipes, skill).slice(0, 3);
    body = now.length ? (
      <ul className="recipe-list">
        {now.map((r) => (
          <RecipeRow key={r.id} recipe={r} skill={skill} />
        ))}
      </ul>
    ) : (
      <p className="small muted prof-line">
        {SKILL_FROM_GATHERING[entry.id]
          ? `Raise it by ${SKILL_FROM_GATHERING[entry.id]}.`
          : `Nothing gives skill at ${skill}.`}
      </p>
    );
  }

  return (
    <li className="prof-card">
      <div className="prof-head">
        <Icon icon={professionIcon(profession.id)} size={28} />
        <span className="prof-name">{profession.name}</span>
        <SkillControl skill={skill} name={profession.name} onSkill={onSkill} />
      </div>
      <SkillBar skill={skill} status={status} />
      <RankCallout skill={skill} status={status} />
      {body}
    </li>
  );
}

/** One profession as a full-height panel for the Trade skills tab. */
export function ProfessionPanel({ entry, level, race, onSkill }: CardProps) {
  const profession = professionById(entry.id);
  const recipes = useRecipes(entry.id, race.faction);
  if (!profession) return null;
  const skill = entry.skill;
  const status = rankStatus(meta.professionRanks, skill, level);
  const kind = NODE_KIND[entry.id];
  const gathering = SKILL_FROM_GATHERING[entry.id];

  return (
    <Panel title={profession.name} icon={professionIcon(profession.id)} className="prof-panel">
      <div className="prof-controls">
        <SkillControl skill={skill} name={profession.name} onSkill={onSkill} big />
      </div>
      <SkillBar skill={skill} status={status} />
      <RankCallout skill={skill} status={status} />

      {kind && <GatherSection kind={kind} skill={skill} level={level} race={race} />}

      {entry.id === 'skinning' && (
        <div className="prof-info">
          <h4>Skinning</h4>
          <p className="small">
            You can skin beasts up to about <b>level {maxSkinLevel(skill)}</b>. Level {level} beasts need skill{' '}
            <b>{skillToSkin(level)}</b>; level {level + 5} beasts need <b>{skillToSkin(level + 5)}</b>.
          </p>
          <p className="small muted">
            Forever's skill text: past 100, skill ÷ 5 is the highest level you can skin. Below 100 this uses the Classic
            rule (skill ÷ 10 + 10).
          </p>
        </div>
      )}

      {entry.id !== 'skinning' &&
        (recipes ? (
          <RecipeSections recipes={recipes} skill={skill} gathering={gathering} compact={!!kind} />
        ) : (
          <p className="muted small">Loading recipes…</p>
        ))}
    </Panel>
  );
}

function GatherSection({
  kind,
  skill,
  level,
  race,
}: {
  kind: GatherNode['kind'];
  skill: number;
  level: number;
  race: Race;
}) {
  const nodes = allNodes(zones, kind);
  const can = nodes.filter((n) => n.skill <= skill);
  const next = nodes.filter((n) => n.skill > skill).slice(0, 3);
  const { openZone } = useModal();
  const nearby = suggestZones(zones, race, level)
    .map((s) => ({ s, nodes: s.zone.nodes.filter((n) => n.kind === kind && n.skill <= skill) }))
    .filter((z) => z.nodes.length > 0);
  return (
    <>
      <h4>{kind === 'herb' ? 'Herbs' : 'Veins'} you can gather</h4>
      {/* Highest skill first: those matter most, and the row is capped to two lines. */}
      <div className="node-row capped">
        <NodeChips nodes={[...can].reverse()} skill={skill} />
        {!can.length && <span className="muted small">None yet.</span>}
      </div>
      {next.length > 0 && (
        <div className="node-row small">
          <span className="muted">Next:</span>
          <NodeChips nodes={next} skill={skill} />
        </div>
      )}
      <h4>Where to gather</h4>
      <FitList className="gather-zones">
        {nearby.length ? (
          nearby.map(({ s, nodes: zn }) => (
            <li
              key={s.zone.id}
              className="gather-zone is-clickable"
              {...clickable(() => openZone(s.zone.id), `${s.zone.name}: quests and map`)}
            >
              <span className="gather-zone-name">
                {s.zone.name} <span className="muted">{s.min === s.max ? s.min : `${s.min}–${s.max}`}</span>
              </span>
              {/* One line per zone, highest skill first; narrow columns clip the low ones. */}
              <span className="node-row small single">
                <NodeChips nodes={[...zn].reverse()} skill={skill} />
              </span>
            </li>
          ))
        ) : (
          <li className="empty">No zones near your level list nodes you can gather.</li>
        )}
      </FitList>
    </>
  );
}

function RecipeSections({
  recipes,
  skill,
  gathering,
  compact,
}: {
  recipes: Recipe[];
  skill: number;
  gathering?: string;
  compact?: boolean;
}) {
  if (!recipes.length) return null;
  const now = skillUpRecipes(recipes, skill);
  const soon = upcomingRecipes(recipes, skill).slice(0, compact ? 2 : 4);
  return (
    <>
      {/* Gathering skills level from nodes and fish, so their recipes only show when there's something to make. */}
      {(now.length > 0 || !gathering) && (
        <h4 title={gathering && `You raise this skill by ${gathering}; recipes are a bonus.`}>
          {gathering ? 'Recipes' : 'Skill-ups'} at {skill}
        </h4>
      )}
      {now.length ? (
        <FitList className="recipe-list">
          {now.map((r) => (
            <RecipeRow key={r.id} recipe={r} skill={skill} />
          ))}
        </FitList>
      ) : (
        !gathering && <Empty>No recipe gives skill at {skill} yet.</Empty>
      )}
      {soon.length > 0 && (
        <div className="prof-soon">
          <h4>Unlocks soon</h4>
          <ul className="recipe-list">
            {soon.map((r) => (
              <RecipeRow key={r.id} recipe={r} skill={skill} upcoming />
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
