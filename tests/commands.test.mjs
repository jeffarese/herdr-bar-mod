import test from "node:test";
import assert from "node:assert/strict";
import { commandRows, keyLabel, humanize, gist } from "../mods/bar/commands.js";

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
