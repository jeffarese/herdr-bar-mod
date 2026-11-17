import test from "node:test";
import assert from "node:assert/strict";
import { commandRows, keyLabel, humanize, gist, modsInLayout } from "../mods/bar/commands.js";

const commands = [
  { name: "tab.new", args: [{ name: "name", required: false }], about: "Make a tab in a space (default: the selected one)." },
  { name: "tab.select", args: [{ name: "index", required: false }], about: "Show a tab." },
  { name: "terminal.kill", args: [{ name: "terminal", required: true }], about: "End a terminal." },
  { name: "pane.split", args: [{ name: "direction", required: true }], about: "Split a pane (default: the focused one)." },
  { name: "space.frob_it", args: [], about: "Something new." },
];
const keys = [
  { section: "global", keys: "cmd-t", action: "tab.new" },
  { section: "global", keys: "cmd-shift-d", action: "pane.split:down" },
  { section: "terminal", keys: "cmd-x", action: "space.frob_it" },
];

test("commands that need no argument are rows, named for people", () => {
  const rows = commandRows({ commands, keys });
  const tab = rows.find((r) => r.key === "c:tab.new");
  assert.equal(tab.title, "New tab");
  assert.equal(tab.detail, "Make a tab in a space");
  assert.equal(tab.keys, "cmd-t");
  assert.ok(!rows.some((r) => r.command === "terminal.kill"), "needs a terminal");
  assert.ok(!rows.some((r) => r.command === "tab.select"), "left out");
});

test("a command the bar doesn't know yet still shows, by its name", () => {
  const row = commandRows({ commands, keys }).find((r) => r.command === "space.frob_it");
  assert.equal(row.title, "Space: frob it");
  assert.equal(row.keys, "", "only global keys count");
});

test("some commands are a row per choice", () => {
  const split = commandRows({ commands, keys }).filter((r) => r.command === "pane.split");
  assert.deepEqual(split.map((r) => [r.title, r.args.direction, r.keys]), [["Split right", "right", ""], ["Split down", "down", "cmd-shift-d"]]);
});

test("themes and layouts are rows too, the ones in use marked", () => {
  const rows = commandRows({ themes: [{ name: "Dusk", light: false, colors: { accent: "#f00" } }, { name: "Paper", light: true, colors: {} }], layouts: ["main", "terminals"], theme: "Paper", layout: "main" });
  assert.deepEqual(rows.map((r) => [r.title, r.current]), [["Theme: Dusk", false], ["Theme: Paper", true], ["Layout: main", true], ["Layout: terminals", false]]);
  assert.deepEqual(rows[0].args, { name: "Dusk" });
  assert.equal(rows[0].colors.accent, "#f00");
});

test("keys read as the platform writes them", () => {
  assert.equal(keyLabel("cmd-shift-t", true), "⇧⌘T");
  assert.equal(keyLabel("cmd-shift-t", false), "Shift+Super+T");
  assert.equal(keyLabel("secondary-enter", true), "⌘↵");
  assert.equal(keyLabel("secondary-enter", false), "Ctrl+↵");
  assert.equal(keyLabel("cmd--", true), "⌘-");
  assert.equal(keyLabel("ctrl-k ctrl-s", false), "Ctrl+K Ctrl+S");
  assert.equal(keyLabel("", true), "");
});

test("names and descriptions are cut to what a row can hold", () => {
  assert.equal(humanize("layout.toggle_all"), "Layout: toggle all");
  assert.equal(gist("Rename a space (asks the person when no name)."), "Rename a space");
  assert.equal(gist("Make a space: its name."), "Make a space");
  assert.equal(gist("Show the welcome again."), "Show the welcome again");
});

test("panel rows hide and show docked mods, handle shared sidebars and stacks, and skip chrome", () => {
  const layoutTree = {
    id: "root",
    type: "row",
    children: [
      { id: "brand", type: "block", content: { mod: "workspace-chrome" } },
      { id: "tabs", type: "block", content: { mod: "tabs" } },
      {
        id: "work",
        type: "column",
        children: [
          { id: "main", type: "block", content: { tab: "active" } },
          {
            id: "panel",
            type: "column",
            hidden: true,
            children: [
              {
                id: "panel-body",
                type: "stack",
                active: "files",
                children: [
                  { id: "files", type: "block", content: { mod: "files" } },
                  { id: "changes", type: "block", content: { mod: "changes" } },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "sidebar-right",
        type: "column",
        children: [
          { id: "prs", type: "block", content: { mod: "github-prs", props: { block: "prs" } } },
        ],
      },
      { id: "stats-left", type: "block", content: { mod: "herdr-stats", props: { spot: "left" } } },
      { id: "stats-right", type: "block", content: { mod: "herdr-stats", props: { spot: "right" } } },
    ],
    floating: [{ id: "stats-float", content: { mod: "herdr-stats", props: { spot: "float" } } }],
  };
  assert.deepEqual(modsInLayout(layoutTree), ["files", "changes", "github-prs", "herdr-stats"]);
  const rows = commandRows({
    layoutTree,
    modTitles: { "github-prs": "Pull requests", "herdr-stats": "System" },
    keys: [{ section: "global", keys: "cmd-shift-g", action: "layout.toggle:sidebar-right" }],
  });
  assert.ok(!rows.some((r) => r.key.includes("brand") || r.key.includes("tabs") || r.key.includes("stats-float")));

  const prs = rows.find((r) => r.key === "c:panel:prs");
  assert.equal(prs.title, "Hide: Pull requests");
  assert.equal(prs.keys, "cmd-shift-g");
  assert.deepEqual(prs.steps, [["layout.hide", { id: "sidebar-right" }]]);

  const files = rows.find((r) => r.key === "c:panel:files");
  assert.equal(files.title, "Show: Files");
  assert.deepEqual(files.steps, [["layout.show", { id: "panel" }]]);

  const changes = rows.find((r) => r.key === "c:panel:changes");
  assert.equal(changes.title, "Show: Changes");
  assert.deepEqual(changes.steps, [
    ["layout.show", { id: "panel" }],
    ["layout.select", { stack: "panel-body", child: "changes" }],
  ]);

  assert.equal(rows.find((r) => r.key === "c:panel:stats-left").title, "Hide: System (left)");
  assert.equal(rows.find((r) => r.key === "c:panel:stats-right").title, "Hide: System (right)");

  // Shared sidebar with visible sibling hides only the chosen block; when sibling is hidden, hides both.
  layoutTree.children[3].children.push({ id: "team", type: "block", content: { mod: "team-agents" } });
  let sharedRows = commandRows({ layoutTree, modTitles: { "github-prs": "Pull requests" } });
  assert.deepEqual(sharedRows.find((r) => r.key === "c:panel:prs").steps, [["layout.hide", { id: "prs" }]]);

  layoutTree.children[3].children[1].hidden = true;
  sharedRows = commandRows({ layoutTree, modTitles: { "github-prs": "Pull requests" } });
  assert.deepEqual(sharedRows.find((r) => r.key === "c:panel:prs").steps, [
    ["layout.hide", { id: "prs" }],
    ["layout.hide", { id: "sidebar-right" }],
  ]);
});
