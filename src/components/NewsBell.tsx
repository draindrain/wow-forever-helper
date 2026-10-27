import { useEffect, useRef, useState } from 'react';
import { useNews } from '../lib/news';

const FOREVER_NEWS_URL = 'https://www.wowhead.com/forever';

function ago(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return days === 1 ? 'yesterday' : `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** A bell in the header with the number of new Wowhead Forever stories; opening it lists them and resets the count. */
export function NewsBell() {
  const { stories, fetchedAt, unread, seen, markSeen } = useNews();
  // Where "new" started when the list was opened, so the new stories stay marked while it's open.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt !== null;
  const isNew = (date: string) => openedAt !== null && date > openedAt;
  const ref = useRef<HTMLDivElement>(null);

  // Opening the list (or news arriving while it's open) marks everything seen.
  useEffect(() => {
    if (open && unread > 0) markSeen();
  }, [open, unread, markSeen]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpenedAt(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenedAt(null);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const label = unread ? `Forever news, ${unread} new` : 'Forever news';
  return (
    <div className="news" ref={ref}>
      <button
        type="button"
        className={`icon-button news-bell ${unread ? 'has-unread' : ''}`}
        onClick={() => setOpenedAt(open ? null : seen)}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="true"
        title={label}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.84V3.5a1.5 1.5 0 0 0-3 0v.66A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z"
          />
        </svg>
        {unread > 0 && (
          <span className="news-badge" aria-hidden="true">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <section className="news-menu panel" aria-label="Latest WoW Forever news">
          <header className="panel-title">
            <h2>Forever news</h2>
            <button type="button" className="icon-button" onClick={() => setOpenedAt(null)} aria-label="Close">
              ×
            </button>
          </header>
          {stories.length ? (
            <ul className="news-list">
              {stories.map((s) => (
                <li key={s.id} className={isNew(s.date) ? 'is-new' : undefined}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    <span className="news-title">{s.title}</span>
                    <span className="news-meta small">
                      {isNew(s.date) && <span className="news-new">New</span>}
                      <time dateTime={s.date} title={new Date(s.date).toLocaleString()}>
                        {ago(s.date)}
                      </time>
                    </span>
                    {s.summary && <span className="news-summary small muted clamp-2">{s.summary}</span>}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="news-empty muted">No news to show right now.</p>
          )}
          <footer className="news-foot small muted">
            <a href={FOREVER_NEWS_URL} target="_blank" rel="noopener noreferrer">
              More on Wowhead
            </a>
            {fetchedAt && <span>Checked {ago(fetchedAt)}</span>}
          </footer>
        </section>
      )}
    </div>
  );
}
