import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { iconUrl } from '../data';
import type { ChangeStatus, ItemTip } from '../types';

export function Panel({
  title,
  icon,
  actions,
  className = '',
  children,
}: {
  title: ReactNode;
  icon?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-title">
        {icon && <Icon icon={icon} size={22} />}
        <h2>{title}</h2>
        {actions && <div className="panel-actions">{actions}</div>}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}

export function Icon({ icon, size = 32, className = '' }: { icon: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <img
      className={`icon ${className}`}
      src={iconUrl(failed || !icon ? 'inv_misc_questionmark' : icon, size > 36 ? 'large' : 'medium')}
      width={size}
      height={size}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

/**
 * WoW-style tooltip shown on hover or keyboard focus, rendered outside the panel so
 * nothing clips it (inside an open <dialog> when the anchor is in one, since a modal
 * dialog sits above everything on <body>). `block` makes a whole row (rendered as `as`)
 * the hover target, with the tooltip following the mouse like the game's.
 */
export function Tooltip({
  content,
  children,
  block,
  as,
  className = '',
}: {
  content: ReactNode;
  children: ReactNode;
  block?: boolean;
  as?: 'li' | 'div';
  className?: string;
}) {
  const anchor = useRef<HTMLElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const mouse = useRef<{ x: number; y: number } | null>(null);
  const [open, setOpen] = useState(false);

  // Positions the tooltip straight on the element, so following the mouse doesn't re-render.
  const place = useCallback(() => {
    if (!anchor.current || !tip.current) return;
    const a = anchor.current.getBoundingClientRect();
    const t = tip.current.getBoundingClientRect();
    const margin = 8;
    const offset = 18;
    let left: number;
    let top: number;
    if (block && mouse.current) {
      const { x, y } = mouse.current;
      left = x + offset + t.width <= window.innerWidth - margin ? x + offset : x - t.width - offset;
      top = y + offset + t.height <= window.innerHeight - margin ? y + offset : y - t.height - offset / 2;
    } else if (block) {
      left = a.right + margin + t.width <= window.innerWidth ? a.right + margin : a.left - t.width - margin;
      top = a.top;
    } else {
      left = a.left + a.width / 2 - t.width / 2;
      top = a.bottom + margin;
      if (top + t.height > window.innerHeight - margin) top = a.top - t.height - margin;
    }
    left = Math.max(margin, Math.min(left, window.innerWidth - t.width - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - t.height - margin));
    tip.current.style.left = `${left}px`;
    tip.current.style.top = `${top}px`;
  }, [block]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  const Tag = block ? (as ?? 'div') : 'span';
  return (
    <Tag
      ref={anchor as never}
      className={`${block ? 'tip-block' : 'tip-anchor'} ${className}`}
      tabIndex={0}
      onMouseEnter={(e: React.MouseEvent) => {
        mouse.current = { x: e.clientX, y: e.clientY };
        setOpen(true);
      }}
      onMouseMove={
        block
          ? (e: React.MouseEvent) => {
              mouse.current = { x: e.clientX, y: e.clientY };
              place();
            }
          : undefined
      }
      onMouseLeave={() => {
        mouse.current = null;
        setOpen(false);
      }}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open &&
        createPortal(
          <div ref={tip} className="wow-tooltip" role="tooltip">
            {content}
          </div>,
          anchor.current?.closest('dialog[open]') ?? document.body,
        )}
    </Tag>
  );
}

/** Gold, silver and copper, as the game shows money. */
export function Money({ copper }: { copper: number }) {
  const g = Math.floor(copper / 10000);
  const s = Math.floor((copper % 10000) / 100);
  const c = copper % 100;
  return (
    <span className="money">
      {g > 0 && <span className="coin coin-gold">{g}</span>}
      {s > 0 && <span className="coin coin-silver">{s}</span>}
      {(c > 0 || copper === 0) && <span className="coin coin-copper">{c}</span>}
    </span>
  );
}

/** The game's item tooltip: name in its quality colour, then the item's lines. */
export function ItemTipView({ item }: { item: ItemTip }) {
  return (
    <>
      <div className={`tt-name q${item.quality}`}>{item.name}</div>
      {item.lines.map((l, i) =>
        l.money !== undefined ? (
          <div key={i} className="tt-line tt-muted">
            {l.t} <Money copper={l.money} />
          </div>
        ) : (
          <div key={i} className={`tt-line ${l.c ? `tt-${l.c}` : ''} ${l.r ? 'tt-lr' : ''}`}>
            <span>{l.t}</span>
            {l.r && <span>{l.r}</span>}
          </div>
        ),
      )}
    </>
  );
}

/** An item icon with its tooltip, a quality-coloured border and an optional stack count. */
export function ItemIcon({ item, count, size = 30 }: { item: ItemTip; count?: number; size?: number }) {
  return (
    <Tooltip content={<ItemTipView item={item} />}>
      <span className={`item-icon q-border-${item.quality}`}>
        <Icon icon={item.icon ?? 'inv_misc_questionmark'} size={size} />
        {count !== undefined && count > 1 && <span className="item-count">{count}</span>}
      </span>
    </Tooltip>
  );
}

const statusLabel: Record<ChangeStatus, string> = {
  new: 'New in Forever',
  changed: 'Changed from Classic',
  unchanged: '',
};

export function StatusMark({ status }: { status: ChangeStatus }) {
  if (status === 'unchanged') return null;
  return (
    <span className={`status-mark status-${status}`} title={statusLabel[status]} aria-label={statusLabel[status]}>
      {status === 'new' ? '★' : '◆'}
    </span>
  );
}

export function statusText(status: ChangeStatus) {
  return statusLabel[status];
}

export function Badge({ tone = 'gold', children, title }: { tone?: string; children: ReactNode; title?: string }) {
  return (
    <span className={`badge badge-${tone}`} title={title}>
      {children}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

/** Small "1 ━━●━━ 60" track with a highlighted range and your level marked. */
export function LevelTrack({
  min,
  max,
  level,
  from = 1,
  to = 60,
}: {
  min: number;
  max: number;
  level: number;
  from?: number;
  to?: number;
}) {
  const pct = (v: number) => `${((Math.min(to, Math.max(from, v)) - from) / (to - from)) * 100}%`;
  return (
    <span className="level-track" aria-hidden="true">
      <span className="level-track-range" style={{ left: pct(min), width: `calc(${pct(max)} - ${pct(min)} + 4px)` }} />
      <span className="level-track-you" style={{ left: pct(level) }} />
    </span>
  );
}

/**
 * Share of a `.stack` column for a `.stack-item`, used only when the page fits the
 * screen (see theme.css). `minHeight` keeps room for the panel's fixed parts.
 */
export function stackShare(grow: number, minHeight?: number): CSSProperties {
  return { ['--grow' as string]: grow, ['--min' as string]: minHeight ? `${minHeight}px` : undefined };
}
