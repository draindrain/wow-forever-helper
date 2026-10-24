import { useState, type CSSProperties } from 'react';
import { mapUrl } from '../../data';
import type { BossPins } from '../../types';
import { Tooltip } from '../ui';

/**
 * The instance map with a numbered pin per boss (where Classic spawns it), next to the
 * numbered boss list; hovering either lights up the other. Without pin data it's the
 * plain map and list.
 */
export function BossMap({
  zoneId,
  bosses,
  pins,
  crop,
}: {
  zoneId?: number;
  bosses: string[];
  pins?: BossPins[];
  /** The drawn part of the image, to zoom to. */
  crop?: [number, number, number, number];
}) {
  const [failed, setFailed] = useState(false);
  const [hot, setHot] = useState<number>();
  const showMap = zoneId !== undefined && !failed;
  const pinned = showMap && pins?.some((b) => b.pins.length > 0);

  return (
    <>
      {showMap && (
        <div className="quest-map">
          <div className="map-layer" style={zoomTo(crop)}>
            <img src={mapUrl(zoneId)} alt="" onError={() => setFailed(true)} />
            {pinned &&
              pins!.flatMap((b, i) =>
                b.pins.map(([x, y], j) => (
                  <span
                    key={`${i}-${j}`}
                    className={`pin-wrap ${hot === i ? 'is-hot' : ''}`}
                    style={{ left: `${x}%`, top: `${y}%` }}
                    onMouseEnter={() => setHot(i)}
                    onMouseLeave={() => setHot(undefined)}
                  >
                    <Tooltip
                      content={
                        <>
                          <div className="tt-name">
                            {i + 1}. {b.name}
                          </div>
                          {b.note && <div className="tt-line">{b.note}</div>}
                          {b.pins.length > 1 && (
                            <div className="tt-line tt-muted">Spawns at one of {b.pins.length} spots.</div>
                          )}
                        </>
                      }
                    >
                      <span className={`boss-pin ${b.pins.length > 1 ? 'is-maybe' : ''}`}>{i + 1}</span>
                    </Tooltip>
                  </span>
                )),
              )}
          </div>
        </div>
      )}
      {bosses.length > 0 && (
        <>
          <h4>Bosses</h4>
          <ol className="boss-list">
            {bosses.map((name, i) => {
              const spots = pins?.[i]?.pins.length ?? 0;
              return (
                <li
                  key={name}
                  className={`${hot === i ? 'is-hot' : ''} ${pinned && !spots ? 'is-unpinned' : ''}`}
                  onMouseEnter={() => spots && setHot(i)}
                  onMouseLeave={() => setHot(undefined)}
                >
                  <span className={`boss-num ${pinned && spots ? 'is-pinned' : ''}`}>{i + 1}</span>
                  <span>
                    {name}
                    {pinned && !spots && (
                      <span className="muted small" title="Summoned or started by an event, so it has no fixed spawn.">
                        {' '}
                        · no fixed spot
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
          {pinned && <p className="small muted">Boss positions are Classic's, from the CMaNGOS server database.</p>}
        </>
      )}
    </>
  );
}

/** Scales and shifts the map layer so `crop` (plus a margin) fills the frame; pins keep their size. */
function zoomTo(crop?: [number, number, number, number]): CSSProperties | undefined {
  if (!crop) return undefined;
  const margin = 3;
  const [x0, y0, x1, y1] = crop;
  const scale = Math.max(1, Math.min(100 / (x1 - x0 + 2 * margin), 100 / (y1 - y0 + 2 * margin), 3));
  const offset = (center: number) => Math.min(0, Math.max(100 - 100 * scale, 50 - center * scale));
  return {
    width: `${scale * 100}%`,
    height: `${scale * 100}%`,
    left: `${offset((x0 + x1) / 2)}%`,
    top: `${offset((y0 + y1) / 2)}%`,
  };
}
