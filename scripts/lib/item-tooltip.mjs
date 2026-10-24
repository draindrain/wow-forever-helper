// Turns a Wowhead tooltip API response for an item into plain tooltip lines, so the
// site never renders third-party HTML.
//
// A line is { t: text, r?: right-aligned text, c?: colour class, money?: copper }.
// Colour classes are Wowhead's: q (gold), q0-q5 (item qualities; q2 is green "Use:"/"Equip:").

import { parse } from 'node-html-parser';

const clean = (s) => s.replace(/\s+/g, ' ').trim();

function colourOf(el) {
  return el.classList ? [...el.classList.values()].find((c) => /^q\d?$/.test(c)) : undefined;
}

function money(el) {
  let copper = 0;
  for (const span of el.querySelectorAll('.moneygold, .moneysilver, .moneycopper')) {
    const n = Number(span.text.replace(/\D/g, '')) || 0;
    copper += span.classList.contains('moneygold') ? n * 10000 : span.classList.contains('moneysilver') ? n * 100 : n;
  }
  return copper;
}

export function parseItemTooltip(json) {
  if (!json?.tooltip) return null;
  const lines = [];
  let current = { t: '', c: undefined };
  const newline = () => {
    const t = clean(current.t);
    if (t) lines.push(current.c ? { t, c: current.c } : { t });
    current = { t: '', c: undefined };
  };
  const append = (text, colour) => {
    if (!clean(current.t)) current.c = colour;
    current.t += text;
  };

  function walk(node, colour) {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        append(child.text, colour);
        continue;
      }
      if (child.nodeType !== 1) continue;
      const tag = child.rawTagName?.toLowerCase();
      const cls = child.classList;
      if (tag === 'br') {
        newline();
      } else if (tag === 'table') {
        const th = child.querySelector('th');
        if (th && child.getAttribute('width') === '100%') {
          // Two-column row, e.g. "Feet | Leather" or "Main Hand | Sword".
          newline();
          lines.push({ t: clean(child.querySelector('td').text), r: clean(th.text) });
        } else {
          newline();
          for (const td of child.querySelectorAll(':scope > tr > td, :scope > tbody > tr > td')) walk(td, colour);
          newline();
        }
      } else if (cls?.contains('whtt-sellprice')) {
        newline();
        lines.push({ t: 'Sell Price:', money: money(child) });
      } else if (cls?.contains('whtt-extra') && !cls.contains('whtt-reagents')) {
        // Wowhead extras the game doesn't show (item level, max stack).
      } else if (tag === 'div') {
        newline();
        walk(child, colourOf(child) ?? colour);
        newline();
      } else {
        walk(child, colourOf(child) ?? colour);
      }
    }
  }

  walk(parse(json.tooltip), undefined);
  newline();
  // The name is shown separately; Wowhead's item level line isn't in the game tooltip.
  const out = lines.filter((l, i) => !(i === 0 && l.t === json.name) && !/^Item Level \d+$/.test(l.t));
  return { name: json.name, quality: json.quality, icon: json.icon, lines: out };
}
