import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Map coordinates are percentages of the image; the layer is `scale` times the frame, shifted by `x`/`y` % of it. */
interface View {
  scale: number;
  x: number;
  y: number;
}

type Point = { x: number; y: number };

const MAX_SCALE = 8;

/** Keeps the map covering the frame, so it can't be zoomed out past whole or dragged off. */
function clamp({ scale, x, y }: View): View {
  const s = Math.min(MAX_SCALE, Math.max(1, scale));
  const bound = (v: number) => Math.min(0, Math.max(100 - 100 * s, v));
  return { scale: s, x: bound(x), y: bound(y) };
}

/** Zooms `view` to `scale`, keeping the point at (`fx`, `fy`) % of the frame where it is. */
function zoomAt(view: View, scale: number, fx: number, fy: number): View {
  const s = Math.min(MAX_SCALE, Math.max(1, scale));
  return clamp({
    scale: s,
    x: fx - ((fx - view.x) / view.scale) * s,
    y: fy - ((fy - view.y) / view.scale) * s,
  });
}

/** The view that fits `crop` (plus a margin) in the frame, or the whole map. */
function fit(crop?: [number, number, number, number]): View {
  if (!crop) return { scale: 1, x: 0, y: 0 };
  const margin = 3;
  const [x0, y0, x1, y1] = crop;
  const scale = Math.max(1, Math.min(100 / (x1 - x0 + 2 * margin), 100 / (y1 - y0 + 2 * margin), 3));
  return clamp({ scale, x: 50 - ((x0 + x1) / 2) * scale, y: 50 - ((y0 + y1) / 2) * scale });
}

/**
 * A map frame that zooms with the mouse wheel, a pinch or the buttons, and pans by dragging.
 * Children (the image and its pins) go on the zoomed layer, positioned in % of the map;
 * the layer is resized rather than transformed, so pins keep their size and tooltips stay put.
 */
export function ZoomableMap({ crop, children }: { crop?: [number, number, number, number]; children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const home = fit(crop);
  const [view, setView] = useState(home);
  const viewRef = useRef(view);
  viewRef.current = view;
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  /** A client point as % of the frame. */
  const toFrame = (cx: number, cy: number) => {
    const r = frame.current!.getBoundingClientRect();
    return [((cx - r.left) / r.width) * 100, ((cy - r.top) / r.height) * 100] as const;
  };

  // React's wheel listener is passive, so it can't stop the page scrolling; this one can.
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const v = viewRef.current;
      const zoomIn = e.deltaY < 0;
      // Fully zoomed out, scrolling down scrolls the page as usual.
      if (!zoomIn && v.scale <= 1) return;
      e.preventDefault();
      const [fx, fy] = toFrame(e.clientX, e.clientY);
      setView(zoomAt(v, v.scale * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.002)), fx, fy));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('.map-zoom')) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    frame.current!.setPointerCapture(e.pointerId);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [Point, Point];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: viewRef.current.scale };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const last = pointers.current.get(e.pointerId);
    if (!last) return;
    const now = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, now);
    const r = frame.current!.getBoundingClientRect();
    const v = viewRef.current;
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()] as [Point, Point];
      const [fx, fy] = toFrame((a.x + b.x) / 2, (a.y + b.y) / 2);
      const scale = (pinch.current.scale * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.current.dist;
      // Half the moving finger's shift pans the midpoint along with it.
      const panned = {
        ...v,
        x: v.x + ((now.x - last.x) / 2 / r.width) * 100,
        y: v.y + ((now.y - last.y) / 2 / r.height) * 100,
      };
      setView(zoomAt(panned, scale, fx, fy));
    } else if (pointers.current.size === 1 && v.scale > 1) {
      if (!dragging && Math.hypot(now.x - last.x, now.y - last.y) > 0) setDragging(true);
      setView(
        clamp({ ...v, x: v.x + ((now.x - last.x) / r.width) * 100, y: v.y + ((now.y - last.y) / r.height) * 100 }),
      );
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) setDragging(false);
  };

  const step = (factor: number) => setView((v) => zoomAt(v, v.scale * factor, 50, 50));
  const atHome = view.scale === home.scale && view.x === home.x && view.y === home.y;

  return (
    <div
      ref={frame}
      className={`quest-map is-zoomable ${view.scale > 1 ? 'is-zoomed' : ''} ${dragging ? 'is-dragging' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('.map-zoom')) return;
        const [fx, fy] = toFrame(e.clientX, e.clientY);
        setView(zoomAt(view, view.scale * 2, fx, fy));
      }}
    >
      <div
        className="map-layer"
        style={{
          width: `${view.scale * 100}%`,
          height: `${view.scale * 100}%`,
          left: `${view.x}%`,
          top: `${view.y}%`,
        }}
      >
        {children}
      </div>
      <div className="map-zoom">
        <button
          type="button"
          title="Zoom in"
          aria-label="Zoom in"
          disabled={view.scale >= MAX_SCALE}
          onClick={() => step(1.5)}
        >
          +
        </button>
        <button
          type="button"
          title="Zoom out"
          aria-label="Zoom out"
          disabled={view.scale <= 1}
          onClick={() => step(1 / 1.5)}
        >
          −
        </button>
        <button
          type="button"
          title="Reset view"
          aria-label="Reset view"
          disabled={atHome}
          onClick={() => setView(home)}
        >
          ⟲
        </button>
      </div>
    </div>
  );
}
