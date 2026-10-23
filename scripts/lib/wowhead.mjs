// Helpers for pulling the data Wowhead embeds in its pages.

/** Returns the text of <script type="application/json" id="..."> or null. */
export function extractJsonScript(html, id) {
  const open = `<script type="application/json" id="${id}">`;
  const start = html.indexOf(open);
  if (start < 0) return null;
  const end = html.indexOf('</script>', start);
  return html.slice(start + open.length, end);
}

/** Scans a JSON array/object literal starting at `start`, returning the index after it. */
function scanLiteral(text, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  throw new Error('unterminated literal');
}

/**
 * Wowhead zone pages build their tabs with `new Listview({ id: 'quests', ..., data: [...] })`.
 * Returns { [listviewId]: dataArray } for every listview with inline JSON data.
 */
export function listviews(html) {
  const out = {};
  const re = /new Listview\(\{/g;
  let m;
  while ((m = re.exec(html))) {
    const head = html.slice(m.index, m.index + 400);
    const id = /id:\s*'([^']+)'/.exec(head)?.[1];
    const dataAt = html.indexOf('data: [', m.index);
    if (!id || dataAt < 0 || dataAt - m.index > 2000) continue;
    const start = dataAt + 'data: '.length;
    try {
      out[id] = JSON.parse(html.slice(start, scanLiteral(html, start)));
    } catch {
      // Listviews whose data isn't plain JSON (comments, screenshots) aren't needed.
    }
  }
  return out;
}
