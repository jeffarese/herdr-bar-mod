// What the bar lists: one row per agent, tab, pane and space, how they are filtered, searched
// and ordered. No app imports here, so `node --test` can run it.

import { match } from "./fuzzy.js";
import { filter } from "./query.js";

export const RANK = { blocked: 4, done: 3, working: 2, idle: 1 };
export const WORDS = { blocked: "Needs you", done: "Done", working: "Working", idle: "Idle" };

/**
 * The lists the person can switch between, in the order the chips show them. `group` puts a
 * thin rule between chips of different groups; `sigil` is the sign that asks for the list
 * from the search field (see query.js).
 */
export const VIEWS = [
  { id: "all", label: "All", group: 0 },
  { id: "agents", label: "Agents", group: 0, sigil: "@" },
  { id: "blocked", label: "Needs you", status: "blocked", group: 1, sigil: "!" },
  { id: "working", label: "Working", status: "working", group: 1 },
  { id: "done", label: "Done", status: "done", group: 1 },
  { id: "idle", label: "Idle", status: "idle", group: 1 },
  { id: "tabs", label: "Tabs", group: 2, sigil: "$" },
  { id: "panes", label: "Panes", group: 2, sigil: "%" },
  { id: "spaces", label: "Spaces", group: 2, sigil: "#" },
  { id: "commands", label: "Commands", group: 3, sigil: ">" },
];

/** A status as one of Herdr's four words, or null for a program that reports none. */
export function statusOf(status) {
  const s = status === "error" ? "blocked" : status;
  return s in RANK ? s : null;
}

/** The machine an address or id is on (`studio/t7` is on studio), or null for this computer. */
export const machineOf = (address) => (address?.includes("/") ? address.slice(0, address.indexOf("/")) : null);

// A title without the status glyph agents put in front of it.
const clean = (s) => (s ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim();

// A terminal title that says what is being done, rather than repeating the program or the folder.
function telling(title, program, address) {
  const live = clean(title);
  if (!live || live === program?.name || live.toLowerCase() === program?.key || live === address) return "";
  const path = /^[~/]|^[A-Za-z]:\\/.test((title ?? "").replace(/^[^\p{L}\p{N}~/]+/u, ""));
  return path || live.includes("@") ? "" : live;
}

/** A folder as a person reads it: `~/workspace/app`, not `/Users/me/workspace/app`. */
export function shortPath(path, home) {
  if (!path) return "";
  if (home && (path === home || path.startsWith(`${home}/`))) return `~${path.slice(home.length)}`;
  return path;
}

/** How long something has run: `47s`, `12m`, `2h04m`, `4d3h`. */
export function duration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h${String(m % 60).padStart(2, "0")}m`;
  return `${Math.floor(h / 24)}d${h % 24}h`;
}

/**
 * Every row the bar can show, from the app's live data (`agents()`, `panes()`, `spaces()`,
 * `terminals()`), unfiltered and unordered.
 *
 * Kinds:
 * - "agent": an agent with a pane, or a sub-agent (`sub: true`, no pane) that one of them started.
 * - "tab": a tab. `plain` is true when no agent runs in it.
 * - "pane": a terminal pane.
 * - "space": a space.
 *
 * Every row has `key` (stable, unique), `title`, `status` (one of Herdr's four words or null),
 * `program`, `space` and `spaceId`, `machine` (null: this computer), `cwd`, `branch`,
 * `current` (it is where the person is now) and the ids its actions need (`tab`, `pane`,
 * `terminal`).
 */
export function build({ agents = [], panes = [], spaces = [], terminals = [] } = {}, { home = null } = {}) {
  const tabs = new Map();
  const spaceOfTab = new Map();
  for (const s of spaces) {
    for (const tab of s.tabs ?? []) {
      tabs.set(tab.id, tab);
      spaceOfTab.set(tab.id, s);
    }
  }
  const paneOf = new Map(panes.filter((p) => p.terminal).map((p) => [p.terminal, p]));
  const termOf = new Map(terminals.map((t) => [t.address, t]));
  const agentsIn = new Map();
  for (const a of agents) agentsIn.set(a.tab, [...(agentsIn.get(a.tab) ?? []), a]);

  const rows = [];
  const tabLabel = (tab) => (tab ? (tab.named ? tab.name : `Tab ${tab.name}`) : "");

  // Agents. One alone in a tab somebody named goes by that name; otherwise by what it says
  // it is doing, and failing that by its program.
  for (const a of agents) {
    const tab = tabs.get(a.tab);
    const space = spaceOfTab.get(a.tab);
    const pane = paneOf.get(a.address);
    const term = termOf.get(a.address);
    // The terminal's title, else the title the agent reports with its status.
    const live = telling(a.title, a.program, a.address) || telling(term?.report?.title, a.program, a.address);
    const alone = (agentsIn.get(a.tab) ?? []).length === 1;
    const named = tab?.named && alone;
    rows.push({
      key: `a:${a.address}`,
      kind: "agent",
      title: named ? tab.name : live || a.program?.name || a.address,
      detail: named ? live : tabLabel(tab),
      status: statusOf(a.status),
      program: a.program,
      space: a.space_name ?? space?.name ?? "",
      spaceId: a.space,
      tab: a.tab,
      pane: a.pane,
      terminal: a.address,
      machine: space?.machine ?? machineOf(a.address),
      cwd: pane?.cwd ?? term?.cwd ?? null,
      branch: pane?.branch ?? null,
      pinned: Boolean(a.pinned),
      current: Boolean(a.focused),
      settled: Boolean(tab?.settled),
      ask: statusOf(a.status) === "blocked" ? question(term?.report) : null,
      created: term?.created_ms ?? null,
      changed: term?.status_ms ?? null,
      subs: 0,
    });
  }

  // Sub-agents: live terminals an agent started that have no pane of their own. They report
  // to their parent, so a finished one is idle, never done.
  const byAddress = new Map(rows.map((r) => [r.terminal, r]));
  const listed = new Set(agents.map((a) => a.address));
  const live = terminals.filter((t) => t.state === "live" && t.parent && !listed.has(t.address));
  const rootOf = (t) => {
    const seen = new Set([t.address]);
    for (let p = termOf.get(t.parent); p && !seen.has(p.address); p = termOf.get(p.parent)) {
      if (byAddress.has(p.address)) return byAddress.get(p.address);
      seen.add(p.address);
    }
    return null;
  };
  for (const t of live) {
    const root = rootOf(t);
    if (!root) continue;
    root.subs += 1;
    const status = statusOf(t.status);
    rows.push({
      key: `a:${t.address}`,
      kind: "agent",
      sub: true,
      title: t.name || telling(t.report?.title ?? t.title, t.program, t.address) || t.template || t.program?.name || t.address,
      detail: `from ${root.title}`,
      status: status === "done" ? "idle" : status,
      program: t.program,
      space: root.space,
      spaceId: root.spaceId,
      tab: root.tab,
      pane: null,
      terminal: t.address,
      machine: root.machine,
      cwd: t.cwd ?? null,
      branch: null,
      pinned: false,
      current: false,
      settled: false,
      ask: status === "blocked" ? question(t.report) : null,
      created: t.created_ms ?? null,
      changed: t.status_ms ?? null,
      subs: 0,
    });
  }

  // Tabs, each led by its first agent, else its focused terminal, else its first terminal.
  const lead = new Map();
  for (const p of panes) {
    if (!p.terminal) continue;
    const now = lead.get(p.tab);
    if (!now || (!now.program?.agent && (p.program?.agent || (!now.focused && p.focused)))) lead.set(p.tab, p);
  }
  for (const s of spaces) {
    for (const tab of s.tabs ?? []) {
      const l = lead.get(tab.id);
      const live = telling(l?.title, l?.program, l?.terminal);
      rows.push({
        key: `t:${tab.id}`,
        kind: "tab",
        plain: !agentsIn.has(tab.id),
        title: tab.named ? tab.name : live || l?.program?.name || tabLabel(tab),
        detail: tab.named ? live : tabLabel(tab),
        status: statusOf(tab.status),
        program: l?.program ?? null,
        space: s.name,
        spaceId: s.id,
        tab: tab.id,
        pane: l?.pane ?? null,
        terminal: l?.terminal ?? null,
        machine: s.machine ?? null,
        cwd: l?.cwd ?? s.folder ?? null,
        branch: l?.branch ?? s.branch ?? null,
        pinned: false,
        current: Boolean(s.active && tab.active),
        settled: Boolean(tab.settled),
        created: termOf.get(l?.terminal)?.created_ms ?? null,
        changed: null,
        subs: 0,
      });
    }
  }

  for (const p of panes) {
    if (!p.terminal) continue;
    const tab = tabs.get(p.tab);
    const space = spaceOfTab.get(p.tab);
    rows.push({
      key: `p:${p.pane}`,
      kind: "pane",
      title: telling(p.title, p.program, p.terminal) || p.program?.name || p.terminal,
      detail: tabLabel(tab),
      status: statusOf(p.status),
      program: p.program,
      space: space?.name ?? "",
      spaceId: space?.id ?? null,
      tab: p.tab,
      pane: p.pane,
      terminal: p.terminal,
      machine: space?.machine ?? machineOf(p.terminal),
      cwd: p.cwd ?? null,
      branch: p.branch ?? null,
      pinned: false,
      current: Boolean(p.focused),
      settled: Boolean(tab?.settled),
      created: termOf.get(p.terminal)?.created_ms ?? null,
      changed: null,
      subs: 0,
    });
  }

  for (const s of spaces) {
    const count = (s.tabs ?? []).length;
    rows.push({
      key: `s:${s.id}`,
      kind: "space",
      title: s.name,
      detail: `${count} tab${count === 1 ? "" : "s"}`,
      status: statusOf(s.status),
      program: null,
      space: s.name,
      spaceId: s.id,
      tab: null,
      pane: null,
      terminal: null,
      machine: s.machine ?? null,
      cwd: s.folder ?? null,
      branch: s.branch ?? null,
      pinned: false,
      current: Boolean(s.active),
      settled: false,
      created: null,
      changed: null,
      subs: 0,
    });
  }
  // The folder as it is shown, so a search lights up the letters the person sees.
  for (const r of rows) r.where = shortPath(r.cwd, r.machine ? null : home);
  return rows;
}

// What a blocked agent asks, from its status report, if it says.
function question(report) {
  const q = report?.msg ?? report?.message ?? report?.question ?? null;
  return typeof q === "string" && q.trim() ? q.trim().split("\n")[0] : null;
}

/** How many agents are in each status: { blocked, working, done, idle }. */
export function counts(rows) {
  const n = { blocked: 0, working: 0, done: 0, idle: 0 };
  for (const r of rows) if (r.kind === "agent" && r.status) n[r.status] += 1;
  return n;
}

/**
 * The rows of one view. "all" is everything worth jumping to: every agent and every tab
 * without one, plus the spaces once the person types (a space is found by name, not browsed).
 */
export function inView(rows, view, searching = false) {
  const status = VIEWS.find((v) => v.id === view)?.status;
  if (status) return rows.filter((r) => r.kind === "agent" && r.status === status);
  if (view === "agents") return rows.filter((r) => r.kind === "agent");
  if (view === "tabs") return rows.filter((r) => r.kind === "tab");
  if (view === "panes") return rows.filter((r) => r.kind === "pane");
  if (view === "spaces") return rows.filter((r) => r.kind === "space");
  return rows.filter((r) => r.kind === "agent" || (r.kind === "tab" && r.plain) || (searching && r.kind === "space"));
}

// A match must average this much per character. Letters scattered through the middle of words
// (the "z", "s" and "h" of a long folder path) score less and don't count as a match.
const ENOUGH = 22;

// What a term may match in a row, and how much a match there counts next to one in the title.
const FIELDS = [
  ["title", 1],
  ["detail", 0.8],
  ["ask", 0.7],
  ["space", 0.7],
  ["branch", 0.6],
  ["programName", 0.6],
  ["machine", 0.5],
  ["where", 0.5],
  ["word", 0.4],
  ["terminal", 0.4],
];

/** The fields a row shows, whose matched letters are lit wherever the term landed. */
export const SHOWN = ["title", "detail", "ask", "space", "branch", "machine", "where"];

/**
 * The rows that match every word in `terms` (a query string, or the words `parse` gives),
 * each as { row, score, positions, hits }: `hits` maps each shown field to the matched
 * characters in it, for highlighting, and `positions` is `hits.title`. A word may match the
 * title, the detail, what a blocked agent asks, the space, the branch, the program, the
 * machine, the folder, the status word or the terminal address, as letters in order that
 * mostly sit together or start words. No words match everything with score 0.
 */
export function search(rows, terms) {
  const words = typeof terms === "string" ? terms.trim().split(/\s+/).filter(Boolean) : terms ?? [];
  if (!words.length) return rows.map((row) => ({ row, score: 0, positions: [], hits: {} }));
  const out = [];
  for (const row of rows) {
    const texts = { ...row, programName: row.program?.name, word: WORDS[row.status] };
    let score = 0;
    const lit = {};
    let all = true;
    for (const term of words) {
      const enough = term.length * ENOUGH;
      let top = null;
      for (const [field, weight] of FIELDS) {
        const found = match(term, texts[field] ?? "");
        if (found && found.score >= enough && (!top || found.score * weight > top.score)) top = { score: found.score * weight };
      }
      if (!top) {
        all = false;
        break;
      }
      score += top.score;
      // Every shown field lights up where the term is in it, not only the one that scored.
      for (const field of SHOWN) {
        const m = texts[field] ? match(term, texts[field]) : null;
        if (m && m.score >= enough) for (const p of m.positions) (lit[field] ??= new Set()).add(p);
      }
    }
    if (!all) continue;
    const hits = Object.fromEntries(Object.entries(lit).map(([f, set]) => [f, [...set].sort((a, b) => a - b)]));
    out.push({ row, score, positions: hits.title ?? [], hits });
  }
  return out;
}

/**
 * Display order. Without a query: agents that need the person, then finished ones, then
 * pinned ones, then what was visited most recently (`recent`: row keys, latest first), then
 * working before idle, then the newest. Settled tabs, which the person put away, come after
 * the rest unless they need the person. With a query, the better match comes first and that
 * order breaks ties.
 */
export function order(found, recent = []) {
  const seen = new Map(recent.map((key, i) => [key, i]));
  const attention = (r) => (r.status === "blocked" ? 2 : r.status === "done" ? 1 : 0);
  const visited = (r) => seen.get(r.key) ?? Infinity;
  const settle = (a, b) =>
    attention(b) - attention(a)
    || Number(Boolean(a.settled)) - Number(Boolean(b.settled))
    || Number(b.pinned) - Number(a.pinned)
    || (visited(a) === visited(b) ? 0 : visited(a) - visited(b))
    || (RANK[b.status] ?? 0) - (RANK[a.status] ?? 0)
    || (b.created ?? 0) - (a.created ?? 0)
    || a.key.localeCompare(b.key, undefined, { numeric: true });
  return [...found].sort((a, b) => b.score - a.score || settle(a.row, b.row));
}

/**
 * Where the selection starts: the first place that is not where the person already is, so
 * opening the bar and pressing Enter goes to the previous place, like alt-tab. With
 * `current`, the place the person is in instead.
 */
export function firstPick(found, current = false) {
  const i = found.findIndex((f) => f.row.kind !== "command" && f.row.kind !== "help" && Boolean(f.row.current) === current);
  return i < 0 ? 0 : i;
}

/** `recent` with `key` moved to the front, at most `limit` long. */
export function visit(recent, key, limit = 60) {
  return [key, ...recent.filter((k) => k !== key)].slice(0, limit);
}

/** The cheat sheet a lone `?` lists: each row puts its sign or filter in the search field. */
export const HELP = [
  ["@", "Agents", "Only agents"],
  ["!", "Needs you", "Agents waiting for you"],
  ["$", "Tabs", "Every tab"],
  ["%", "Panes", "Every terminal pane"],
  ["#", "Spaces", "Every space"],
  [">", "Commands", "Run a Herdr command, switch theme or layout"],
  ["is:", "is:working", "By status or kind: needs, working, done, idle, pinned, sub, here, settled, remote, local"],
  ["on:", "on:studio", "On one machine; on:local for this computer"],
  ["in:", "in:api", "In one space"],
  ["app:", "app:codex", "Running one program"],
  ["-is:", "-is:idle", "A leading minus leaves those out"],
].map(([insert, title, detail]) => ({
  key: `h:${insert}`,
  kind: "help",
  insert: insert.endsWith(":") ? insert : `${insert} `,
  sign: insert,
  title,
  detail,
  status: null,
  program: null,
  space: "",
  spaceId: null,
  machine: null,
  current: false,
  pinned: false,
}));

// How many commands an "All" search shows after the places it found.
const COMMANDS_IN_ALL = 4;

/**
 * The list the bar shows, as [{ row, score, positions, hits, group }], from the rows `build`
 * made, the command rows, the chosen chip, a parsed query (query.js) and the recently visited
 * keys. `group` is "places", "commands" or "help"; the view draws a heading where it changes.
 *
 * A leading sign wins over the chip. "All" with a search adds the best few commands after the
 * places, unless a filter narrows the places (commands have no status, space or machine).
 */
export function compose({ rows = [], commands = [], view = "all", parsed, recent = [], withCommands = true }) {
  const scope = parsed.scope ?? view;
  const tag = (group) => (f) => ({ ...f, group });
  if (scope === "help") return HELP.map((row) => ({ row, score: 0, positions: [], hits: {}, group: "help" }));
  if (scope === "commands") {
    const found = search(commands, parsed.terms);
    // A search orders by match; without one, the app's own order, current theme and layout marked.
    return (parsed.terms.length ? [...found].sort((a, b) => b.score - a.score) : found).map(tag("commands"));
  }
  const searching = parsed.terms.length > 0 || parsed.filters.some((f) => f.valid);
  const places = order(search(filter(inView(rows, scope, searching), parsed.filters), parsed.terms), recent).map(tag("places"));
  if (scope !== "all" || !withCommands || !parsed.terms.length || parsed.filters.length) return places;
  const words = parsed.terms.join("");
  if (words.length < 2) return places;
  const extra = [...search(commands, parsed.terms)].sort((a, b) => b.score - a.score).slice(0, COMMANDS_IN_ALL);
  return [...places, ...extra.map(tag("commands"))];
}
