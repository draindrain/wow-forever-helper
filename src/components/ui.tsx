import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { iconUrl } from '../data';
import type { ChangeStatus } from '../types';

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

/** WoW-style tooltip shown on hover or keyboard focus, rendered on <body> so panels can't clip it. */
export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!open || !anchor.current || !tip.current) return;
    const a = anchor.current.getBoundingClientRect();
    const t = tip.current.getBoundingClientRect();
    const margin = 8;
    let left = a.left + a.width / 2 - t.width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - t.width - margin));
    let top = a.bottom + margin;
    if (top + t.height > window.innerHeight - margin) top = Math.max(margin, a.top - t.height - margin);
    setPos({ left, top });
  }, [open]);

  return (
    <span
      ref={anchor}
      className="tip-anchor"
      tabIndex={0}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open &&
        createPortal(
          <div ref={tip} className="wow-tooltip" role="tooltip" style={{ left: pos.left, top: pos.top }}>
            {content}
          </div>,
          document.body,
        )}
    </span>
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
