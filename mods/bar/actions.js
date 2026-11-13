// What can be done to a row, for the actions menu (⌘. or a right-click). No app imports
// here, so `node --test` can run it.

/**
 * The actions for a row, in menu order: [{ id, label, key?, danger? }]. `key` names the
 * shortcut that does the same from the list ("enter", "peek", "rename", "close"), for the
 * menu to show. `run` turns one into the app command it stands for.
 */
export function actionsFor(r) {
  if (!r) return [];
  if (r.kind === "command") return [{ id: "go", label: "Run", key: "enter" }];
  if (r.kind === "help") return [{ id: "go", label: "Use", key: "enter" }];
  const out = [];
  const add = (id, label, extra = {}) => out.push({ id, label, ...extra });
  if (r.kind === "space") {
    add("go", "Show space", { key: "enter" });
    add("new-tab", "New tab in this space");
    add("rename", "Rename space", { key: "rename" });
    add("close", "Close space", { key: "close", danger: true });
    return out;
  }
  if (r.sub) {
    add("go", "Peek", { key: "enter" });
    add("keep", "Give it a tab");
    add("close", "End agent", { key: "close", danger: true });
    return out;
  }
  add("go", r.kind === "tab" ? "Go to tab" : r.kind === "pane" ? "Go to pane" : "Go to agent", { key: "enter" });
  if (r.terminal) add("peek", "Peek without leaving", { key: "peek" });
  if (r.tab) add("rename", "Rename tab", { key: "rename" });
  if (r.kind === "agent") add(r.pinned ? "unpin" : "pin", r.pinned ? "Unpin" : "Pin to the top");
  if (r.pane && r.kind !== "tab") add("zoom", "Zoom pane");
  if (r.tab) add(r.settled ? "unsettle" : "settle", r.settled ? "Bring the tab back" : "Settle tab (put it away)");
  if (r.kind === "pane") add("close", "Close pane", { key: "close", danger: true });
  else add("close", "Close tab", { key: "close", danger: true });
  return out;
}

/**
 * The app command an action runs, as [name, args], or null for one the view does itself
 * (going somewhere, renaming).
 */
export function run(id, r) {
  switch (id) {
    case "peek":
      return ["terminal.peek", { terminal: r.terminal }];
    case "pin":
      return ["terminal.pin", { terminal: r.terminal, pinned: true }];
    case "unpin":
      return ["terminal.pin", { terminal: r.terminal, pinned: false }];
    case "zoom":
      return ["pane.zoom", { pane: r.pane }];
    case "settle":
      return ["tab.settle", { id: r.tab }];
    case "unsettle":
      return ["tab.unsettle", { id: r.tab }];
    case "keep":
      return ["terminal.keep", { terminal: r.terminal }];
    case "new-tab":
      return ["tab.new", { space: r.spaceId }];
    case "close":
      if (r.kind === "space") return ["space.close", { id: r.spaceId, confirmed: true }];
      if (r.kind === "pane") return ["pane.close", { pane: r.pane }];
      if (r.sub) return ["terminal.kill", { terminal: r.terminal }];
      return ["tab.close", { id: r.tab, confirmed: true }];
    default:
      return null;
  }
}

/** Whether an action leaves the bar: going, peeking, zooming and opening things do; the rest
 *  change the row in place, so the person can carry on. */
export const leaves = (id) => ["go", "peek", "zoom", "keep", "new-tab"].includes(id);
