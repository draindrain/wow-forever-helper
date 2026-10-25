import { useState } from 'react';
import { mapUrl } from '../../data';
import { levelColor, type Difficulty } from '../../lib/game';
import type { Quest } from '../../types';
import { Tooltip } from '../ui';
import type { HoverProps } from './QuestViews';
import { ZoomableMap } from './ZoomableMap';

interface Pin {
  key: string;
  kind: 'start' | 'end';
  name: string;
  x: number;
  y: number;
  quests: Quest[];
}

const order: Difficulty[] = ['orange', 'yellow', 'green', 'red', 'grey'];

/** Pins for quest givers on this map; one per giver, listing all their quests. */
function pinsFor(quests: Quest[], zoneId: number): Pin[] {
  const pins = new Map<string, Pin>();
  for (const q of quests) {
    for (const kind of ['start', 'end'] as const) {
      const g = q[kind];
      if (!g?.coord || g.zone !== zoneId) continue;
      // A turn-in where the quest was picked up needs no second pin.
      if (kind === 'end' && q.start?.coord && q.start.name === g.name && q.start.zone === g.zone) continue;
      const key = `${kind}|${g.name}|${g.coord.join(',')}`;
      const pin = pins.get(key) ?? { key, kind, name: g.name, x: g.coord[0], y: g.coord[1], quests: [] };
      pin.quests.push(q);
      pins.set(key, pin);
    }
  }
  // Turn-ins under pick-ups, so "!" marks stay on top.
  return [...pins.values()].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'end' ? -1 : 1));
}

export function QuestMap({
  zoneId,
  quests,
  level,
  hovered,
  onHover,
}: { zoneId: number; quests: Quest[]; level: number } & HoverProps) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  const pins = pinsFor(quests, zoneId);
  return (
    <>
      <ZoomableMap key={zoneId}>
        <img src={mapUrl(zoneId)} alt="" draggable={false} onError={() => setFailed(true)} />
        {pins.map((pin) => {
          // The pin takes the colour of its most worthwhile quest, as the game's "!" does.
          const colors = pin.quests.map((q) => levelColor(q.level, level));
          const color = order.find((c) => colors.includes(c)) ?? 'grey';
          const hot = pin.quests.some((q) => q.id === hovered);
          return (
            <span
              key={pin.key}
              className={`pin-wrap ${hot ? 'is-hot' : ''}`}
              style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
              onMouseEnter={() => onHover?.(pin.quests[0]?.id)}
              onMouseLeave={() => onHover?.(undefined)}
            >
              <Tooltip
                content={
                  <>
                    <div className="tt-name">{pin.name}</div>
                    <div className="tt-line tt-muted">
                      {pin.kind === 'start' ? 'Gives' : 'Takes'} {pin.quests.length} quest
                      {pin.quests.length > 1 ? 's' : ''} · {pin.x.toFixed(1)}, {pin.y.toFixed(1)}
                    </div>
                    {pin.quests.map((q) => (
                      <div key={q.id} className="tt-line">
                        <span className={`d-${levelColor(q.level, level)}`}>[{q.level}]</span> {q.name}
                      </div>
                    ))}
                  </>
                }
              >
                <span className={`pin pin-${pin.kind} pin-${color}`}>{pin.kind === 'start' ? '!' : '?'}</span>
              </Tooltip>
            </span>
          );
        })}
      </ZoomableMap>
      <div className="map-legend small">
        <span>
          <span className="pin pin-start pin-yellow">!</span> Pick up
        </span>
        <span>
          <span className="pin pin-end pin-yellow">?</span> Turn in
        </span>
        <span className="muted">
          Colour shows the quest's difficulty for you. Hover a quest to find it; scroll or pinch to zoom, drag to pan.
        </span>
      </div>
    </>
  );
}
