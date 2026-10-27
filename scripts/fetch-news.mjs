// Fetches Wowhead's WoW Forever news feed and writes the latest stories as JSON for the
// site's news bell. Wowhead has no webhooks and its feed doesn't allow cross-origin requests,
// so the site can't read it directly: .github/workflows/news.yml runs this on a schedule and
// redeploys when the stories change, and the deploy workflow writes dist/news.json with it.
//
//   node scripts/fetch-news.mjs <out.json> [--fallback=<url>] [--compare=<url>]
//
// --fallback: when the feed can't be fetched, copy this (the deployed news.json) instead, so a
//             deploy never wipes the list. Without it, a failed fetch exits with an error.
// --compare:  also fetch this (the deployed news.json) and print changed=true|false to
//             $GITHUB_OUTPUT (or stdout), comparing the stories, not the fetch time. A failed
//             fetch is a warning and changed=false, so the next scheduled check tries again.

import { appendFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const FEED_URL = 'https://www.wowhead.com/news/rss/forever';
const MAX_STORIES = 20;
const USER_AGENT = 'Mozilla/5.0 (compatible; wow-forever-helper; +https://wow.drnz.se/)';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', raquo: '»', laquo: '«', hellip: '…' };

function decode(s) {
  return s
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1));
      return ENTITIES[e.toLowerCase()] ?? m;
    });
}

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1].trim()) : '';
};

/** The feed's stories, newest first: id, title, url, date (ISO), summary (plain text). */
export function parseFeed(xml) {
  const stories = [];
  for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const url = tag(item, 'link');
    const id = (tag(item, 'guid') || url).match(/news=(\d+)/)?.[1] ?? url;
    const date = new Date(tag(item, 'pubDate'));
    const summary = tag(item, 'description')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/Continue reading\s*»?/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!url || Number.isNaN(date.getTime())) continue;
    stories.push({ id, title: tag(item, 'title'), url, date: date.toISOString(), summary });
  }
  return stories.sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX_STORIES);
}

async function get(url, accept) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: accept },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

/** Fetches the feed; throws when it can't be read or has no stories (a bot check page, say). */
export async function fetchNews() {
  const stories = parseFeed(await get(FEED_URL, 'application/rss+xml, application/xml'));
  if (!stories.length) throw new Error(`${FEED_URL}: no stories in the response`);
  return { fetchedAt: new Date().toISOString(), source: FEED_URL, stories };
}

async function fetchDeployed(url) {
  try {
    const news = JSON.parse(await get(url, 'application/json'));
    return Array.isArray(news?.stories) ? news : null;
  } catch {
    return null;
  }
}

const sameStories = (a, b) =>
  JSON.stringify(a.map((s) => [s.id, s.title, s.date])) === JSON.stringify(b.map((s) => [s.id, s.title, s.date]));

async function main() {
  const args = process.argv.slice(2);
  const out = args.find((a) => !a.startsWith('--'));
  const opt = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  if (!out) throw new Error('usage: node scripts/fetch-news.mjs <out.json> [--fallback=<url>] [--compare=<url>]');

  let news;
  try {
    news = await fetchNews();
  } catch (err) {
    if (opt('compare')) {
      // A scheduled check: say so in the run log and try again next time.
      console.log(`::warning::Couldn't fetch the news feed: ${err.message}`);
      if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'changed=false\n');
      return;
    }
    const fallback = opt('fallback') && (await fetchDeployed(opt('fallback')));
    if (!fallback) throw err;
    console.warn(`Couldn't fetch the news feed (${err.message}); keeping the deployed news.json.`);
    news = fallback;
  }
  writeFileSync(out, JSON.stringify(news) + '\n');
  console.log(`${out}: ${news.stories.length} stories, newest ${news.stories[0]?.date ?? 'none'}`);

  if (opt('compare')) {
    const deployed = await fetchDeployed(opt('compare'));
    const changed = !deployed || !sameStories(deployed.stories, news.stories);
    const line = `changed=${changed}`;
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, line + '\n');
    console.log(line);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
