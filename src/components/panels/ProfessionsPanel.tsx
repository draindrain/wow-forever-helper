import { useState } from 'react';
import { loadRecipes, meta, professionById, zones } from '../../data';
import { clampSkill } from '../../lib/characters';
import {
  allNodes,
  learnSkill,
  maxSkinLevel,
  rankStatus,
  recipeColor,
  skillToSkin,
  skillUpRecipes,
  upcomingRecipes,
} from '../../lib/game';
import { professionIcon } from '../../lib/icons';
import { useAsync } from '../../lib/useAsync';
import type { Character, CharacterProfession, Faction, Recipe } from '../../types';
import { Badge, Empty, Icon, Panel, StatusMark, Tooltip } from '../ui';

function RecipeTip({ recipe, skill }: { recipe: Recipe; skill: number }) {
  const learn = learnSkill(recipe);
  return (
    <>
      <div className="tt-head">
        <span className={`tt-name q${recipe.quality}`}>{recipe.name}</span>
      </div>
      <div className="tt-line tt-muted">{recipe.heading}</div>
      {recipe.reagents.length > 0 && (
        <div className="tt-line">
          Reagents: {recipe.reagents.map((r) => `${r.count > 1 ? `${r.count}× ` : ''}${r.name}`).join(', ')}
        </div>
      )}
      <div className="tt-line tt-bands">
        <span className="d-orange">Orange</span> to {Math.max(0, (recipe.yellow ?? 1) - 1)} ·{' '}
        <span className="d-yellow">Yellow</span> {recipe.yellow} · <span className="d-green">Green</span>{' '}
        {recipe.green} · <span className="d-grey">Grey</span> {recipe.grey}
      </div>
      <div className="tt-line tt-req">
        {recipe.source === 'item'
          ? `Learned from ${recipe.taughtBy ?? 'a recipe item'}${learn.known ? ` (skill ${learn.skill})` : ''}`
          : learn.known
            ? `Trainer, skill ${learn.skill}`
            : `Trainer. The skill it needs isn't in the client; usually about ${learn.skill}.`}
      </div>
      <div className={`tt-line d-${recipeColor(recipe, skill)}`}>At {skill}: {recipeColor(recipe, skill)}</div>
      {recipe.status !== 'unchanged' && (
        <div className={`tt-line tt-${recipe.status}`}>{recipe.status === 'new' ? 'New in Forever' : 'Changed from Classic'}</div>
      )}
    </>
  );
}

function RecipeRow({ recipe, skill, upcoming }: { recipe: Recipe; skill: number; upcoming?: boolean }) {
  const color = recipeColor(recipe, skill);
  const learn = learnSkill(recipe);
  return (
    <li className="recipe">
      <Tooltip content={<RecipeTip recipe={recipe} skill={skill} />}>
        <Icon icon={recipe.icon} size={24} />
      </Tooltip>
      <div className="recipe-text">
        <span className={`recipe-name ${upcoming ? '' : `d-${color}`}`}>
          {recipe.name}
          <StatusMark status={recipe.status} />
        </span>
        <span className="recipe-sub">
          {recipe.reagents.map((r) => `${r.count}× ${r.name}`).join(', ') || recipe.heading}
        </span>
      </div>
      <span className="recipe-side">
        {upcoming ? (
          <span className="muted">
            at {learn.skill}
            {!learn.known && '~'}
          </span>
        ) : (
          recipe.source === 'item' && <Badge tone="blue" title={recipe.taughtBy}>Recipe</Badge>
        )}
        {recipe.heading === 'Camping' && <Badge tone="green">Camping</Badge>}
      </span>
    </li>
  );
}

const SHOWN = 6;

// Professions you level by gathering or catching, not by crafting.
const SKILL_FROM_GATHERING: Record<string, string> = {
  herbalism: 'picking herbs',
  mining: 'mining veins',
  fishing: 'catching fish',
};

function RecipeLists({ professionId, skill, faction }: { professionId: string; skill: number; faction: Faction }) {
  const [all, setAll] = useState(false);
  const loaded = useAsync(`recipes:${professionId}`, () => loadRecipes(professionId));
  if (!loaded) return <p className="muted small">Loading recipes…</p>;
  const recipes = loaded.filter((r) => !r.faction || r.faction === faction);
  if (!recipes.length) return null;
  const now = skillUpRecipes(recipes, skill);
  const soon = upcomingRecipes(recipes, skill).slice(0, 4);
  const gathering = SKILL_FROM_GATHERING[professionId];
  return (
    <>
      <h4>{gathering ? 'Recipes' : 'Skill-ups'} at {skill}</h4>
      {gathering && <p className="small muted">You raise this skill by {gathering}; these recipes are a bonus.</p>}
      {now.length ? (
        <ul className="recipe-list">
          {(all ? now : now.slice(0, SHOWN)).map((r) => (
            <RecipeRow key={r.id} recipe={r} skill={skill} />
          ))}
        </ul>
      ) : (
        <Empty>{gathering ? `Nothing to make at ${skill}.` : `No recipe gives skill at ${skill} yet.`}</Empty>
      )}
      {now.length > SHOWN && (
        <button type="button" className="link-button" onClick={() => setAll((v) => !v)}>
          {all ? 'Show fewer' : `Show all ${now.length}`}
        </button>
      )}
      {soon.length > 0 && (
        <>
          <h4>Unlocks soon</h4>
          <ul className="recipe-list">
            {soon.map((r) => (
              <RecipeRow key={r.id} recipe={r} skill={skill} upcoming />
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function GatherNodes({ kind, skill }: { kind: 'herb' | 'ore'; skill: number }) {
  const nodes = allNodes(zones, kind);
  const can = nodes.filter((n) => n.skill <= skill);
  const next = nodes.filter((n) => n.skill > skill).slice(0, 3);
  return (
    <>
      <h4>{kind === 'herb' ? 'Herbs' : 'Veins'} you can gather</h4>
      <div className="node-row">
        {can.slice(-6).map((n) => (
          <span key={n.name} className={`node node-${kind}`}>
            {n.name} <span className="muted">{n.skill}</span>
          </span>
        ))}
        {!can.length && <span className="muted small">None yet.</span>}
      </div>
      {next.length > 0 && (
        <div className="node-row small">
          <span className="muted">Next:</span>
          {next.map((n) => (
            <span key={n.name} className="node node-next">
              {n.name} at {n.skill}
            </span>
          ))}
        </div>
      )}
      <p className="small muted">Zones in "Where to quest" list the nodes you can gather there.</p>
    </>
  );
}

function ProfessionCard({
  entry,
  level,
  faction,
  onSkill,
}: {
  entry: CharacterProfession;
  level: number;
  faction: Faction;
  onSkill: (skill: number) => void;
}) {
  const profession = professionById(entry.id);
  if (!profession) return null;
  const skill = entry.skill;
  const status = rankStatus(meta.professionRanks, skill, level);
  const next = status.next;
  const step = (n: number) => onSkill(clampSkill(skill + n));

  return (
    <div className="prof-card">
      <div className="prof-head">
        <Icon icon={professionIcon(profession.id)} size={32} />
        <div className="prof-title">
          <span className="prof-name">{profession.name}</span>
          <span className="muted small">{status.current.name}</span>
        </div>
        <div className="skill-control">
          <button type="button" onClick={() => step(-5)} aria-label="Minus 5">
            −5
          </button>
          <button type="button" onClick={() => step(-1)} aria-label="Minus 1">
            −
          </button>
          <input
            type="number"
            min={1}
            max={300}
            value={skill}
            aria-label={`${profession.name} skill`}
            onChange={(e) => onSkill(clampSkill(Number(e.target.value) || 1))}
          />
          <button type="button" onClick={() => step(1)} aria-label="Plus 1">
            +
          </button>
          <button type="button" onClick={() => step(5)} aria-label="Plus 5">
            +5
          </button>
        </div>
      </div>
      <div className="skill-bar" aria-hidden="true">
        <span style={{ width: `${(Math.min(skill, status.current.maxSkill) / status.current.maxSkill) * 100}%` }} />
        <em>
          {skill} / {status.current.maxSkill}
        </em>
      </div>
      {next && skill >= next.minSkill && (
        <p className={`rank-callout ${status.canTrainNext ? 'is-ready' : ''}`}>
          {status.canTrainNext ? (
            <>
              <b>Train {next.name}</b> to raise your cap to {next.maxSkill}.
              {!next.confirmed && ` Forever hasn't confirmed its level ${next.level} requirement.`}
            </>
          ) : (
            <>
              {next.name} unlocks at <b>level {next.level}</b>
              {!next.confirmed && ' (Classic value)'}.
            </>
          )}
          {status.capped && ' You’re at your cap and not gaining skill.'}
        </p>
      )}
      {next && skill < next.minSkill && (
        <p className="small muted">
          {next.name} at skill {next.minSkill} and level {next.level}
          {!next.confirmed && ' (Classic value)'}.
        </p>
      )}

      {profession.id === 'herbalism' && <GatherNodes kind="herb" skill={skill} />}
      {profession.id === 'mining' && <GatherNodes kind="ore" skill={skill} />}
      {profession.id === 'skinning' && (
        <>
          <h4>Skinning</h4>
          <p className="small">
            You can skin beasts up to about <b>level {maxSkinLevel(skill)}</b>. Level {level} beasts need skill{' '}
            <b>{skillToSkin(level)}</b>.
          </p>
          <p className="small muted">Forever's skill text: past 100, skill ÷ 5 is the highest level you can skin. Below 100 this uses the Classic rule (skill ÷ 10 + 10).</p>
        </>
      )}
      {profession.id !== 'skinning' && <RecipeLists professionId={profession.id} skill={skill} faction={faction} />}
    </div>
  );
}

const favorCamp: Record<Faction, string> = {
  Alliance: 'the Azeroth Commerce Authority camp at Three Corners in Redridge',
  Horde: 'the Durotar Supply and Logistics camp west of the Crossroads',
};

export function ProfessionsPanel({
  character,
  faction,
  onSkill,
  onEdit,
}: {
  character: Character;
  faction: Faction;
  onSkill: (professionId: string, skill: number) => void;
  onEdit: () => void;
}) {
  return (
    <Panel title="Trade skills" icon="trade_blacksmithing" className="panel-professions">
      {character.professions.length ? (
        <div className="prof-grid">
          {character.professions.map((p) => (
            <ProfessionCard
              key={p.id}
              entry={p}
              level={character.level}
              faction={faction}
              onSkill={(s) => onSkill(p.id, s)}
            />
          ))}
        </div>
      ) : (
        <Empty>
          No trade skills picked.{' '}
          <button type="button" className="link-button" onClick={onEdit}>
            Add some
          </button>
        </Empty>
      )}
      <p className="source small muted">
        Recipes and their colour thresholds come from the Forever client. Trainers keep their skill requirements on
        the server, so a "~" marks an estimate. Fill loot crates and turn them in at {favorCamp[faction]} for
        reputation and Merchant's Favor, which buys many of the new recipes.
      </p>
    </Panel>
  );
}
