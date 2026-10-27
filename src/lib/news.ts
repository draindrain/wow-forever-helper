import { useCallback, useEffect, useState } from 'react';

/** A Wowhead WoW Forever news story, as scripts/fetch-news.mjs writes it to news.json. */
export interface NewsStory {
  id: string;
  title: string;
  url: string;
  /** ISO date it was posted. */
  date: string;
  summary: string;
}

interface NewsFile {
  fetchedAt: string;
  stories: NewsStory[];
}

const NEWS_URL = `${import.meta.env.BASE_URL}news.json`;
const SEEN_KEY = 'wow-forever-helper:news-seen';
/** How often an open page checks for news; it also checks when the tab comes back into view. */
const POLL_MS = 5 * 60_000;
const MIN_RECHECK_MS = 60_000;
/** On a first visit, stories from the last week count as new. */
const FIRST_VISIT_WINDOW_MS = 7 * 24 * 60 * 60_000;

function readSeen(): string {
  try {
    const seen = localStorage.getItem(SEEN_KEY);
    if (seen) return seen;
  } catch {
    // Storage blocked: fall through to the first-visit default.
  }
  return new Date(Date.now() - FIRST_VISIT_WINDOW_MS).toISOString();
}

export interface News {
  stories: NewsStory[];
  fetchedAt?: string;
  /** Stories posted after the newest one the visitor has seen. */
  unread: number;
  /** The date of the newest story seen; stories after it are new. */
  seen: string;
  /** Marks every story in the list as seen. */
  markSeen: () => void;
}

/** The latest news, refreshed while the page is open, with an unread count kept in local storage. */
export function useNews(): News {
  const [file, setFile] = useState<NewsFile | null>(null);
  const [seen, setSeen] = useState(readSeen);

  useEffect(() => {
    let live = true;
    let last = 0;
    const load = async () => {
      if (Date.now() - last < MIN_RECHECK_MS) return;
      last = Date.now();
      try {
        // no-cache revalidates with the server, so a new deploy shows up on the next check.
        const res = await fetch(NEWS_URL, { cache: 'no-cache' });
        if (!res.ok) return;
        const data = (await res.json()) as NewsFile;
        if (live && Array.isArray(data.stories)) setFile(data);
      } catch {
        // Offline or no news.json (a local build): keep what we have.
      }
    };
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && void load();
    // Another tab marked the news seen.
    const onStorage = (e: StorageEvent) => e.key === SEEN_KEY && setSeen(readSeen());
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('storage', onStorage);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const stories = file?.stories ?? [];
  const newest = stories[0]?.date;
  const markSeen = useCallback(() => {
    if (!newest) return;
    setSeen((prev) => {
      if (prev >= newest) return prev;
      try {
        localStorage.setItem(SEEN_KEY, newest);
      } catch {
        // The count resets for this visit only.
      }
      return newest;
    });
  }, [newest]);

  return {
    stories,
    fetchedAt: file?.fetchedAt,
    unread: stories.filter((s) => s.date > seen).length,
    seen,
    markSeen,
  };
}
