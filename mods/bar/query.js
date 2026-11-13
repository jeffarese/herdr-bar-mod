// The search language. A query is an optional scope sign, filter words and search words:
//
//   @ login on:studio        agents only, on studio, matching "login"
//   -is:idle in:api          everything in the api space that is not idle
//
// No app imports here, so `node --test` can run it.

/** A first character that picks the list, whatever chip is chosen. */
export const SIGILS = {
  "@": "agents",
  "!": "blocked",
  $: "tabs",
  "%": "panes",
  "#": "spaces",
  ">": "commands",
};

/** Filter words: `key:value`, `-key:value` to leave those out. */
export const FILTERS = {
  is: "status or kind: needs, working, done, idle, pinned, sub, here, settled, remote, local",
  on: "machine: on:studio, on:local",
  in: "space: in:api",
  app: "program: app:claude",
};

// The words `is:` knows, each a test on a row.
const IS = {
  needs: (r) => r.status === "blocked",
  blocked: (r) => r.status === "blocked",
  error: (r) => r.status === "blocked",
  working: (r) => r.status === "working",
  done: (r) => r.status === "done",
  idle: (r) => r.status === "idle",
  pinned: (r) => Boolean(r.pinned),
  sub: (r) => Boolean(r.sub),
  here: (r) => Boolean(r.current),
  current: (r) => Boolean(r.current),
  settled: (r) => Boolean(r.settled),
  remote: (r) => Boolean(r.machine),
  local: (r) => !r.machine,
  agent: (r) => r.kind === "agent",
  tab: (r) => r.kind === "tab",
  pane: (r) => r.kind === "pane",
  space: (r) => r.kind === "space",
};

const LOCAL = new Set(["local", "here", "this"]);
const lower = (s) => (s ?? "").toLowerCase();

// One word of a query, with where it sits, so a filter can be taken out again.
const WORD = /(-?)([a-z]+):("[^"]*"?|\S*)|"[^"]*"?|\S+/g;

/**
 * Splits a query into { scope, sigil, filters, terms, text }:
 * - `scope`: the list a leading sign asks for (see SIGILS), "help" for a lone `?`, else null;
 * - `filters`: [{ key, value, neg, raw, start, end, valid }], `start`/`end` index `query`;
 *   a filter with no value yet (`on:`) is left out of the search but kept here;
 * - `terms`: the search words, for `search`;
 * - `text`: what is left once the sign and the filters are gone.
 */
export function parse(query = "") {
  let at = 0;
  while (at < query.length && /\s/.test(query[at])) at++;
  let scope = null;
  let sigil = null;
  if (query[at] in SIGILS) {
    sigil = query[at];
    scope = SIGILS[sigil];
    at++;
  }
  if (!scope && query.trim() === "?") return { scope: "help", sigil: "?", filters: [], terms: [], text: "" };
  const filters = [];
  const kept = [];
  let last = at;
  WORD.lastIndex = at;
  for (let m = WORD.exec(query); m; m = WORD.exec(query)) {
    const [raw, neg, key, value] = m;
    if (key && key in FILTERS) {
      const v = value.replace(/^"|"$/g, "");
      filters.push({ key, value: v, neg: neg === "-", raw, start: m.index, end: m.index + raw.length, valid: valid(key, v) });
      kept.push(query.slice(last, m.index));
      last = m.index + raw.length;
    }
  }
  kept.push(query.slice(last));
  const text = kept.join("").replace(/\s+/g, " ").trim();
  const terms = text.split(" ").map((w) => w.replace(/^"|"$/g, "")).filter(Boolean);
  return { scope, sigil, filters, terms, text };
}

function valid(key, value) {
  if (!value) return false;
  if (key === "is") return lower(value) in IS;
  return true;
}

/** Whether a row passes one filter. Filters without a value pass everything. */
export function passes(row, f) {
  if (!f.valid) return true;
  const v = lower(f.value);
  let ok;
  if (f.key === "is") ok = IS[v](row);
  else if (f.key === "on") ok = LOCAL.has(v) ? !row.machine : lower(row.machine).includes(v);
  else if (f.key === "in") ok = lower(row.space).includes(v);
  else if (f.key === "app") ok = lower(row.program?.key).includes(v) || lower(row.program?.name).includes(v);
  else ok = true;
  return f.neg ? !ok : ok;
}

/** The rows that pass every filter. */
export function filter(rows, filters = []) {
  const live = filters.filter((f) => f.valid);
  return live.length ? rows.filter((r) => live.every((f) => passes(r, f))) : rows;
}

/** `query` with one filter taken out, as the person would have typed it without. */
export function without(query, f) {
  const before = query.slice(0, f.start).replace(/\s+$/, "");
  const after = query.slice(f.end).replace(/^\s+/, "");
  return before && after ? `${before} ${after}` : before + after;
}

/** How a filter reads on its pill: "on studio", "not idle". */
export function pill(f) {
  const words = { is: "", on: "on ", in: "in ", app: "" };
  return `${f.neg ? "not " : ""}${words[f.key]}${f.value || "…"}`;
}
