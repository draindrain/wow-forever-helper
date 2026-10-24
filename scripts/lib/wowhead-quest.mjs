// Parses a Wowhead (Forever) quest page into the compact record the build uses.

import { parse } from 'node-html-parser';

const decode = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');

/** Finds the JSON object literal passed to `marker(` and parses it. */
function jsonArg(html, marker) {
  const at = html.indexOf(marker);
  if (at < 0) return null;
  const start = html.indexOf('{', at);
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try {
        return JSON.parse(html.slice(start, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** The Quick Facts box is written as Wowhead markup in a JS string; return its [li] lines. */
function quickFacts(html) {
  const m = /WH\.markup\.printHtml\(("(?:[^"\\]|\\.)*"), "infobox-contents-0"/.exec(html);
  if (!m) return [];
  const markup = JSON.parse(m[1]);
  return [...markup.matchAll(/\[li\]([\s\S]*?)\[\/li\]/g)].map((x) => x[1]);
}

/** "Start: [url=/forever/npc=197/marshal-mcbride]Marshal McBride[/url]" -> { kind, id, name } */
function giver(line) {
  const m = /\[url=\/forever\/(npc|object|item)=(\d+)[^\]]*\]([^[]*)\[\/url\]/.exec(line);
  return m ? { kind: m[1], id: Number(m[2]), name: decode(m[3]) } : undefined;
}

/** The nodes after an <h2> up to the next one (the parser doesn't link text nodes as siblings). */
function section(heading) {
  if (!heading) return [];
  const nodes = heading.parentNode.childNodes;
  const out = [];
  for (let i = nodes.indexOf(heading) + 1; i < nodes.length && nodes[i].rawTagName !== 'h2'; i++) out.push(nodes[i]);
  return out;
}

function rewards(doc) {
  const out = { choices: [], items: [], xp: undefined, money: 0, rep: [] };
  const h2 = (title) => doc.querySelectorAll('h2').find((h) => h.text.trim() === title);
  const rewardNodes = section(h2('Rewards'));
  // Each phrase ("You will receive:", "You will be able to choose one of ...") precedes an icon table.
  let mode = 'items';
  for (const el of rewardNodes) {
    if (el.nodeType === 3) {
      if (/choose one/i.test(el.text)) mode = 'choices';
      else if (/receive/i.test(el.text)) mode = 'items';
    } else if (el.rawTagName === 'table') {
      for (const row of el.querySelectorAll('tr')) {
        const link = row.querySelectorAll('a').find((a) => /\/item=\d+/.test(a.getAttribute('href') ?? ''));
        if (!link) continue;
        const id = Number(/item=(\d+)/.exec(link.getAttribute('href'))[1]);
        const count = Number(/\((\d+)\)/.exec(row.text)?.[1] ?? 1);
        out[mode].push([id, count]);
      }
    }
  }
  const xp = /id="quest-reward-xp">([\d,]+) experience/.exec(doc.toString());
  if (xp) out.xp = Number(xp[1].replace(/,/g, ''));
  for (const el of [...rewardNodes, ...section(h2('Gains'))]) {
    if (!el.querySelectorAll) continue;
    for (const span of el.querySelectorAll('.moneygold, .moneysilver, .moneycopper')) {
      const n = Number(span.text.replace(/\D/g, '')) || 0;
      out.money += span.classList.contains('moneygold') ? n * 10000 : span.classList.contains('moneysilver') ? n * 100 : n;
    }
  }
  for (const li of doc.querySelectorAll('li')) {
    const a = li.querySelector('a[href*="/faction="]');
    const amount = /(-?\d[\d,]*)\s*reputation with/.exec(li.text);
    if (a && amount) out.rep.push([decode(a.text.trim()), Number(amount[1].replace(/,/g, ''))]);
  }
  return out;
}

export function parseQuestPage(id, html) {
  if (!html.includes('infobox-contents-0')) return null;
  const doc = parse(html);
  const facts = quickFacts(html);
  const fact = (re) => facts.map((f) => re.exec(f)).find(Boolean);
  const description = doc.querySelector('meta[name="description"]')?.getAttribute('content') ?? '';
  // "Take X to Y. A level 5 Elwynn Forest Quest. +50 reputation ... Added in ..." -> the objective sentence(s).
  const summary = decode(description.split(/\s+A level \d+|\s+A level-\?|\s+Added in /)[0]).trim();

  const series = [];
  for (const row of doc.querySelectorAll('table.series tr')) {
    const step = row.querySelectorAll('td div').map((div) => {
      const link = div.querySelector('a[href*="/quest="]');
      return link
        ? { id: Number(/quest=(\d+)/.exec(link.getAttribute('href'))[1]), name: decode(link.text.trim()) }
        : { id, name: decode(div.text.trim()) };
    });
    if (step.length) series.push(step);
  }

  const mapper = jsonArg(html, 'new Mapper(');
  const points = [];
  for (const [zoneId, zone] of Object.entries(mapper?.objectives ?? {})) {
    for (const level of zone.levels ?? []) {
      for (const p of level) {
        if (p.point !== 'start' && p.point !== 'end') continue;
        points.push({ point: p.point, zone: Number(zoneId), zoneName: zone.zone, name: p.name, coord: p.coord });
      }
    }
  }

  const tagIds = (text, tag) =>
    text ? [...text.matchAll(new RegExp(`\\[${tag}=(\\d+)\\]`, 'g'))].map((m) => Number(m[1])) : undefined;
  const sideText = fact(/^Side: \[span[^\]]*\]([^[]+)/)?.[1];
  return {
    id,
    name: decode(doc.querySelector('h1.heading-size-1')?.text.trim() ?? /<title>([^<]*?) - Quest/.exec(html)?.[1] ?? ''),
    level: Number(fact(/^Level: (-?\d+)/)?.[1] ?? 0),
    reqLevel: Number(fact(/^Requires level (\d+)/)?.[1] ?? 0) || undefined,
    side: sideText === 'Alliance' || sideText === 'Horde' ? sideText : 'Both',
    type: fact(/^Type: ([^[]+)/)?.[1]?.trim(),
    // Client class and race ids ("Classes: [class=1], [class=2]").
    classes: tagIds(fact(/^Class(?:es)?: (.+)/)?.[1], 'class'),
    races: tagIds(fact(/^Races?: (.+)/)?.[1], 'race'),
    start: giver(facts.find((f) => f.includes('Start:')) ?? ''),
    end: giver(facts.find((f) => f.includes('End:')) ?? ''),
    summary,
    series: series.length > 1 ? series : undefined,
    points,
    rewards: rewards(doc),
  };
}
