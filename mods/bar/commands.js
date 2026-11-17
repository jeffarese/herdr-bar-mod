// The app's commands as rows the bar can run: what `commands()` lists, plus a row per theme
// and per layout. No app imports here, so `node --test` can run it.

// Names people read, for the commands that need no argument. A command the app adds later
// still shows, called after its name ("tab.foo_bar" reads "Tab: foo bar").
const LABELS = {
  "space.new": "New space",
  "space.close": "Close space",
  "space.rename": "Rename space",
  "space.next": "Next space",
  "space.prev": "Previous space",
  "tab.new": "New tab",
  "tab.close": "Close tab",
  "tab.rename": "Rename tab",
  "tab.next": "Next tab",
  "tab.prev": "Previous tab",
  "tab.settle": "Settle tab",
  "pane.close": "Close pane",
  "pane.zoom": "Zoom pane",
  "terminal.open": "New terminal",
  "terminal.search": "Find in terminal",
  "agent.next": "Next agent",
  "agent.prev": "Previous agent",
  "layout.switch": "Next layout",
  "app.help": "Keyboard shortcuts",
  "app.welcome": "Show welcome",
  "app.whats_new": "What's new",
  "app.feedback": "Send feedback",
  "app.palette": "Command palette",
  "app.settings": "Settings",
  "app.check_updates": "Check for updates",
  "app.update_core": "Update herdr-core",
  "app.zoom_in": "Zoom in",
  "app.zoom_out": "Zoom out",
  "app.zoom_reset": "Actual size",
  "app.update": "Restart to update",
  "app.quit": "Quit Herdr",
  "app.hide": "Hide Herdr",
  "app.hide_others": "Hide others",
  "app.show_all": "Show all",
  "window.close": "Close window",
  "window.minimize": "Minimize window",
  "window.maximize": "Maximize window",
};

// Commands that need an argument the bar has no way to ask for, act on a selection the bar
// never has, or are an escape hatch better reached on purpose.
const LEFT_OUT = new Set([
  "space.select",
  "tab.select",
  "tab.unsettle",
  "pane.focus",
  "pane.swap",
  "terminal.show",
  "terminal.copy",
  "terminal.paste",
  "terminal.paste_image",
  "overlay.close",
  "app.reset",
  "layout.reset",
  "app.theme",
  "app.update",
]);

// Commands worth one row per choice of their first argument.
const SPREAD = {
  "pane.split": [
    { label: "Split right", args: { direction: "right" } },
    { label: "Split down", args: { direction: "down" } },
  ],
  "terminal.scroll": [
    { label: "Scroll to top", args: { to: "top" } },
    { label: "Scroll to bottom", args: { to: "bottom" } },
  ],
  "app.settings": [
    { label: "Settings", args: {} },
    { label: "Settings: Look", args: { section: "look" } },
    { label: "Settings: Alerts", args: { section: "alerts" } },
    { label: "Settings: Updates", args: { section: "updates" } },
  ],
};

/** "tab.foo_bar" as "Tab: foo bar". */
export function humanize(name) {
  const [head, ...rest] = name.split(".");
  const what = rest.join(" ").replace(/_/g, " ");
  return `${head[0].toUpperCase()}${head.slice(1)}: ${what}`;
}

/** The first sentence of a command's description, for the row's second half. */
export function gist(about = "") {
  const cut = about.search(/\s\(|[.:;](\s|$)/);
  return (cut > 0 ? about.slice(0, cut) : about).trim();
}

/**
 * A key binding as the person presses it: "cmd-shift-t" reads "⌘⇧T" on a Mac and
 * "Ctrl+Shift+T" elsewhere. Several strokes are joined by a space.
 */
export function keyLabel(keys, mac) {
  if (!keys?.trim()) return "";
  const names = mac ? { ctrl: "⌃", alt: "⌥", shift: "⇧", cmd: "⌘", fn: "fn" } : { ctrl: "Ctrl", alt: "Alt", shift: "Shift", cmd: "Super", fn: "Fn" };
  const alias = { secondary: mac ? "cmd" : "ctrl", super: "cmd", win: "cmd", control: "ctrl", option: "alt" };
  const special = { enter: "↵", escape: "Esc", backspace: "⌫", delete: "Del", tab: "Tab", space: "Space", left: "←", right: "→", up: "↑", down: "↓", pageup: "PgUp", pagedown: "PgDn" };
  return keys.trim().split(/\s+/).map((stroke) => {
    const parts = stroke.split("-");
    let key = parts.pop();
    if (key === "") {
      key = "-";
      parts.pop();
    }
    const held = new Set(parts.map((m) => alias[m.toLowerCase()] ?? m.toLowerCase()));
    const label = special[key] ?? (key.length === 1 ? key.toUpperCase() : key[0].toUpperCase() + key.slice(1));
    return [...Object.keys(names).filter((m) => held.has(m)).map((m) => names[m]), label].join(mac ? "" : "+");
  }).join(" ");
}

/** The global key bound to a command with these arguments, or "". */
function bound(keys, name, args) {
  const first = Object.values(args)[0];
  const wanted = first === undefined ? [name] : [`${name}:${first}`];
  const hit = keys.find((k) => k.section === "global" && typeof k.action === "string" && wanted.includes(k.action));
  return hit?.keys ?? "";
}

const commandRow = (key, title, detail, command, args, keys, extra = {}) => ({
  key,
  kind: "command",
  title,
  detail,
  command,
  args,
  keys,
  status: null,
  program: null,
  space: "",
  spaceId: null,
  machine: null,
  current: false,
  pinned: false,
  ...extra,
});

const CHROME_MODS = new Set(["workspace-chrome", "tabs"]);
const BUILTIN_TITLES = {
  files: "Files",
  changes: "Changes",
  spaces: "Spaces",
  agents: "Agents",
  "workspace-status": "Status bar",
};

const prettyMod = (name) => {
  const words = String(name).replace(/[-_]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : String(name);
};

const holdsTabs = (n) => Boolean(n?.content?.tab) || (n?.children ?? []).some(holdsTabs);
const stackActiveId = (stack) => stack?.active ?? (stack?.children ?? []).find((c) => c && !c.hidden && c.id != null)?.id;

function isPathHidden(path) {
  for (let i = 0; i < path.length; i++) {
    if (path[i]?.hidden === true) return true;
    if (i >= 1 && path[i - 1]?.type === "stack" && stackActiveId(path[i - 1]) !== path[i]?.id) return true;
  }
  return false;
}

function hideSteps(path) {
  let targetIdx = path.length - 1;
  for (let k = targetIdx - 1; k >= 1; k--) {
    const parent = path[k];
    if (holdsTabs(parent)) break;
    if (parent.type === "stack" || (parent.children ?? []).length === 1) {
      if (parent.id) targetIdx = k;
    } else {
      break;
    }
  }
  const steps = [];
  if (path[targetIdx]?.id) steps.push(["layout.hide", { id: path[targetIdx].id }]);
  const newlyHidden = new Set([path[targetIdx]]);
  for (let i = targetIdx - 1; i >= 1; i--) {
    const anc = path[i];
    if (holdsTabs(anc)) break;
    const children = anc.children ?? [];
    const anyVisible = anc.type === "stack"
      ? false
      : children.some((c) => c && !c.hidden && !newlyHidden.has(c));
    if (!anyVisible) {
      if (anc.id) steps.push(["layout.hide", { id: anc.id }]);
      newlyHidden.add(anc);
    } else {
      break;
    }
  }
  return steps;
}

function showSteps(path) {
  const steps = [];
  for (let i = 1; i < path.length; i++) {
    if (path[i]?.hidden === true && path[i]?.id) steps.push(["layout.show", { id: path[i].id }]);
    if (path[i - 1]?.type === "stack" && path[i - 1]?.id && path[i]?.id) {
      const active = stackActiveId(path[i - 1]);
      if (active !== path[i].id) steps.push(["layout.select", { stack: path[i - 1].id, child: path[i].id }]);
    }
  }
  if (!steps.length && path.at(-1)?.id) steps.push(["layout.show", { id: path.at(-1).id }]);
  return steps;
}

function collectBlocks(node, path = [], out = []) {
  if (!node || typeof node !== "object") return out;
  const here = [...path, node];
  if (node.type === "block" && typeof node.id === "string" && typeof node.content?.mod === "string" && !CHROME_MODS.has(node.content.mod)) {
    out.push({ node, path: here });
  }
  for (const child of node.children ?? []) collectBlocks(child, here, out);
  return out;
}

/** Unique mod names for toggleable block nodes in a layout tree. */
export function modsInLayout(tree) {
  const mods = new Set();
  for (const { node } of collectBlocks(tree)) mods.add(node.content.mod);
  return [...mods];
}

function panelKey(keys, ids, mod) {
  const wanted = new Set([...ids.filter(Boolean).map((id) => `layout.toggle:${id}`), `mod.open:${mod}`]);
  const idSet = new Set(ids.filter(Boolean));
  const hit = keys.find((k) => {
    if (k.section !== "global") return false;
    if (typeof k.action === "string") return wanted.has(k.action);
    if (k.action && typeof k.action === "object") {
      return (k.action.command === "layout.toggle" && idSet.has(k.action.args?.id))
        || (k.action.command === "mod.open" && k.action.args?.name === mod);
    }
    return false;
  });
  return hit?.keys ?? "";
}

function panelRows(tree, keys, modTitles) {
  const blocks = collectBlocks(tree);
  if (!blocks.length) return [];
  const bases = blocks.map(({ node }) => {
    const mod = node.content.mod;
    const propTitle = typeof node.content.props?.title === "string" ? node.content.props.title.trim() : "";
    return propTitle || modTitles?.[mod] || BUILTIN_TITLES[mod] || prettyMod(mod);
  });
  const counts = new Map();
  for (const b of bases) counts.set(b, (counts.get(b) ?? 0) + 1);
  return blocks.map(({ node, path }, i) => {
    const mod = node.content.mod;
    const base = bases[i];
    const qualifier = node.content.props?.spot ?? node.content.props?.block ?? node.id;
    const label = counts.get(base) > 1 ? `${base} (${qualifier})` : base;
    const hidden = isPathHidden(path);
    const steps = hidden ? showSteps(path) : hideSteps(path);
    const [command, args] = steps[0] ?? [hidden ? "layout.show" : "layout.hide", { id: node.id }];
    const shortcut = panelKey(keys, [node.id, args?.id], mod);
    return commandRow(
      `c:panel:${node.id}`,
      hidden ? `Show: ${label}` : `Hide: ${label}`,
      hidden ? `Hidden panel · ${mod}` : `Panel · ${mod}`,
      command,
      args,
      shortcut,
      {
        steps,
        about: hidden ? `Show the ${label} panel (${mod}) in this layout.` : `Hide the ${label} panel (${mod}) in this layout.`,
        keywords: hidden ? `show open unhide toggle panel mod ${label} ${mod} ${node.id}` : `hide close toggle panel mod ${label} ${mod} ${node.id}`,
      },
    );
  });
}

/**
 * Every command the bar can run, as rows of kind "command": { title, detail, command, args,
 * keys }. From `commands()` (those that need no argument), panel show/hide rows for `layoutTree`,
 * a row per theme (`app.theme`) and per layout (`layout.switch`). `keys` is the raw global
 * binding, for keyLabel.
 */
export function commandRows({ commands = [], keys = [], themes = [], layouts = [], theme = null, layout = null, layoutTree = null, modTitles = {} } = {}) {
  const rows = [];
  for (const c of commands) {
    if (LEFT_OUT.has(c.name)) continue;
    const spread = SPREAD[c.name];
    if (spread) {
      for (const s of spread) rows.push(commandRow(`c:${c.name}:${JSON.stringify(s.args)}`, s.label, gist(c.about), c.name, s.args, bound(keys, c.name, s.args), { about: c.about }));
      continue;
    }
    if (c.args.some((a) => a.required)) continue;
    rows.push(commandRow(`c:${c.name}`, LABELS[c.name] ?? humanize(c.name), gist(c.about), c.name, {}, bound(keys, c.name, {}), { about: c.about }));
  }
  rows.push(...panelRows(layoutTree, keys, modTitles));
  for (const t of themes) {
    rows.push(commandRow(`c:theme:${t.name}`, `Theme: ${t.name}`, t.light ? "Light theme" : "Dark theme", "app.theme", { name: t.name }, "", { colors: t.colors, current: t.name === theme }));
  }
  for (const l of layouts) {
    rows.push(commandRow(`c:layout:${l}`, `Layout: ${l}`, "Show this layout", "layout.switch", { name: l }, "", { current: l === layout }));
  }
  return rows;
}
