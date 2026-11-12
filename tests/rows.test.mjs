import test from "node:test";
import assert from "node:assert/strict";
import { build, counts, inView, search, order, firstPick, visit, duration, shortPath, statusOf, machineOf } from "../mods/bar/rows.js";

const claude = { key: "claude", name: "Claude Code", agent: true };
const zsh = { key: "shell", name: "zsh", shell: true, agent: false };

// Two spaces: "app" here with an agent tab and a shell tab, "api" on studio with one agent.
function world(more = {}) {
  const tab = (id, name, extra = {}) => ({ id, index: 1, name, named: false, active: false, status: null, ...extra });
  return {
    spaces: [
      { id: "s1", name: "app", folder: "/Users/me/app", machine: null, branch: "main", active: true, status: "working",
        tabs: [tab("tb1", "1", { active: true, status: "working" }), tab("tb2", "2")] },
      { id: "studio/s2", name: "api", folder: "/srv/api", machine: "studio", branch: null, active: false, status: "blocked",
        tabs: [tab("studio/tb3", "deploy", { named: true, active: true, status: "blocked" })] },
    ],
    agents: [
      { address: "t1", pane: "p1", space: "s1", space_name: "app", tab: "tb1", status: "working", program: claude, title: "✳ Fix the login form", pinned: false, focused: true },
      { address: "studio/t7", pane: "studio/p3", space: "studio/s2", space_name: "api", tab: "studio/tb3", status: "blocked", program: claude, title: "Roll out v2", pinned: false, focused: false },
    ],
    panes: [
      { pane: "p1", terminal: "t1", tab: "tb1", title: "✳ Fix the login form", cwd: "/Users/me/app", branch: "login", status: "working", program: claude, focused: true },
      { pane: "p2", terminal: "t2", tab: "tb2", title: "~/app", cwd: "/Users/me/app", branch: "main", status: null, program: zsh, focused: false },
      { pane: "studio/p3", terminal: "studio/t7", tab: "studio/tb3", title: "Roll out v2", cwd: "/srv/api", branch: "release", status: "blocked", program: claude, focused: false },
    ],
    terminals: [
      { address: "t1", state: "live", parent: null, program: claude, status: "working", created_ms: 1000, status_ms: 5000 },
      { address: "t2", state: "live", parent: null, program: zsh, status: null, created_ms: 2000 },
      { address: "studio/t7", state: "live", parent: null, program: claude, status: "blocked", created_ms: 3000 },
    ],
    ...more,
  };
}
const keys = (found) => found.map((f) => (f.row ?? f).key);
const byKey = (rows, key) => rows.find((r) => r.key === key);

test("an agent goes by what it says it is doing, without its status glyph", () => {
  const a = byKey(build(world()), "a:t1");
  assert.equal(a.title, "Fix the login form");
  assert.equal(a.detail, "Tab 1");
  assert.equal(a.branch, "login");
  assert.equal(a.created, 1000);
  assert.equal(a.changed, 5000);
  assert.equal(a.current, true);
});

test("an agent alone in a named tab goes by the tab's name, its own title beside it", () => {
  const a = byKey(build(world()), "a:studio/t7");
  assert.equal(a.title, "deploy");
  assert.equal(a.detail, "Roll out v2");
  assert.equal(a.machine, "studio");
});

test("two agents in a named tab go by their own titles", () => {
  const w = world();
  w.agents.push({ ...w.agents[1], address: "studio/t8", pane: "studio/p4", title: "Watch the logs" });
  const rows = build(w);
  assert.equal(byKey(rows, "a:studio/t7").title, "Roll out v2");
  assert.equal(byKey(rows, "a:studio/t8").title, "Watch the logs");
  assert.equal(byKey(rows, "a:studio/t8").detail, "deploy");
});

test("an agent whose title says nothing goes by its program", () => {
  const w = world();
  w.agents[0].title = "~/app";
  assert.equal(byKey(build(w), "a:t1").title, "Claude Code");
});

test("a title that only repeats the terminal's address says nothing", () => {
  const w = world();
  w.panes[1].title = "t2";
  assert.equal(byKey(build(w), "t:tb2").title, "zsh");
  assert.equal(byKey(build(w), "p:p2").title, "zsh");
});

test("a sub-agent without a pane is listed under its parent's tab, never done", () => {
  const w = world();
  w.terminals.push({ address: "t9", state: "live", parent: "t1", program: claude, status: "done", name: "review", created_ms: 4000 });
  w.terminals.push({ address: "t10", state: "finished", parent: "t1", program: claude, status: "done" });
  const rows = build(w);
  const sub = byKey(rows, "a:t9");
  assert.equal(sub.sub, true);
  assert.equal(sub.pane, null);
  assert.equal(sub.tab, "tb1");
  assert.equal(sub.status, "idle");
  assert.equal(sub.detail, "from Fix the login form");
  assert.equal(byKey(rows, "a:t1").subs, 1);
  assert.equal(byKey(rows, "a:t10"), undefined);
});

test("a terminal started by something outside the spaces is not a sub-agent row", () => {
  const w = world();
  w.terminals.push({ address: "t20", state: "live", parent: "t99", program: claude, status: "working" });
  assert.equal(byKey(build(w), "a:t20"), undefined);
});

test("every tab has a row; one without an agent is plain", () => {
  const rows = build(world());
  assert.equal(byKey(rows, "t:tb1").plain, false);
  assert.equal(byKey(rows, "t:tb2").plain, true);
  assert.equal(byKey(rows, "t:tb2").title, "zsh");
  assert.equal(byKey(rows, "t:tb1").current, true);
});

test("counts are of agents by status", () => {
  assert.deepEqual(counts(build(world())), { blocked: 1, working: 1, done: 0, idle: 0 });
});

test('"all" lists agents and plain tabs, and spaces only while searching', () => {
  const rows = build(world());
  assert.deepEqual(keys(inView(rows, "all")).sort(), ["a:studio/t7", "a:t1", "t:tb2"]);
  assert.deepEqual(keys(inView(rows, "all", true)).sort(), ["a:studio/t7", "a:t1", "s:s1", "s:studio/s2", "t:tb2"]);
});

test("status views list agents in that status; the other views list one kind", () => {
  const rows = build(world());
  assert.deepEqual(keys(inView(rows, "blocked")), ["a:studio/t7"]);
  assert.deepEqual(keys(inView(rows, "idle")), []);
  assert.deepEqual(keys(inView(rows, "tabs")), ["t:tb1", "t:tb2", "t:studio/tb3"]);
  assert.deepEqual(keys(inView(rows, "panes")), ["p:p1", "p:p2", "p:studio/p3"]);
  assert.deepEqual(keys(inView(rows, "spaces")), ["s:s1", "s:studio/s2"]);
});

test("search matches the title, and says which characters", () => {
  const found = search(inView(build(world()), "all"), "login");
  assert.deepEqual(keys(found), ["a:t1"]);
  assert.deepEqual(found[0].positions, [8, 9, 10, 11, 12]);
});

test("search matches the branch, machine, folder, program and status word too", () => {
  const rows = inView(build(world()), "all");
  assert.deepEqual(keys(search(rows, "release")), ["a:studio/t7"]);
  assert.deepEqual(keys(search(rows, "studio")), ["a:studio/t7"]);
  assert.deepEqual(keys(search(rows, "/srv")), ["a:studio/t7"]);
  assert.deepEqual(keys(search(rows, "zsh")), ["t:tb2"]);
  assert.deepEqual(keys(search(rows, "needs")), ["a:studio/t7"]);
});

test("letters scattered through a long folder path are not a match", () => {
  const w = world();
  w.panes[0].cwd = "/private/tmp/stage.ZwTMYI/home/code/shop";
  assert.deepEqual(keys(search(inView(build(w), "all"), "zsh")), ["t:tb2"]);
});

test("one letter matches where a word starts with it, not inside words", () => {
  const rows = inView(build(world()), "all");
  assert.deepEqual(keys(search(rows, "l")), ["a:t1"]);
  assert.deepEqual(keys(search(rows, "x")), []);
});

test("initials of the words in a title are a match", () => {
  assert.deepEqual(keys(search(inView(build(world()), "all"), "ftl")), ["a:t1"]);
});

test("an agent with no telling terminal title goes by the title it reports", () => {
  const w = world();
  w.agents[0].title = "claude";
  w.terminals[0].report = { title: "Speed up the checkout page" };
  assert.equal(byKey(build(w), "a:t1").title, "Speed up the checkout page");
});

test("every word of the query must match, in any field", () => {
  const rows = inView(build(world()), "all");
  assert.deepEqual(keys(search(rows, "claude studio")), ["a:studio/t7"]);
  assert.deepEqual(keys(search(rows, "claude nowhere")), []);
});

test("a match in a field other than the title leaves the title unlit", () => {
  assert.deepEqual(search(inView(build(world()), "all"), "release")[0].positions, []);
});

test("without a query: needs you, then done, then pinned, then recent, then working before idle", () => {
  const w = world();
  const add = (address, status, extra = {}) => {
    w.agents.push({ address, pane: `p-${address}`, space: "s1", space_name: "app", tab: "tb1", status, program: claude, title: address, pinned: false, focused: false, ...extra });
    w.terminals.push({ address, state: "live", parent: null, program: claude, status, created_ms: 10 });
  };
  add("t30", "idle");
  add("t31", "done");
  add("t32", "idle", { pinned: true });
  add("t33", "idle");
  const found = order(search(inView(build(w), "all"), ""), ["a:t33", "a:t1"]);
  assert.deepEqual(keys(found), ["a:studio/t7", "a:t31", "a:t32", "a:t33", "a:t1", "a:t30", "t:tb2"]);
});

test("with a query the better match comes first", () => {
  const w = world();
  w.agents[1].title = "Plan the api";
  w.spaces[1].tabs[0].named = false;
  const found = order(search(inView(build(w), "all", true), "api"));
  assert.equal(found[0].row.key, "s:studio/s2");
});

test("the selection starts on the first row that is not where the person is", () => {
  const rows = build(world());
  const here = { row: byKey(rows, "a:t1"), score: 0, positions: [] };
  const there = { row: byKey(rows, "a:studio/t7"), score: 0, positions: [] };
  assert.equal(firstPick([here, there]), 1);
  assert.equal(firstPick([there, here]), 0);
  assert.equal(firstPick([here]), 0);
  assert.equal(firstPick([]), 0);
});

test("visit moves a key to the front and keeps the list short", () => {
  assert.deepEqual(visit(["a", "b", "c"], "c"), ["c", "a", "b"]);
  assert.deepEqual(visit(["a", "b"], "z", 2), ["z", "a"]);
});

test("durations read as herdr-bar's do", () => {
  assert.equal(duration(47_000), "47s");
  assert.equal(duration(12 * 60_000), "12m");
  assert.equal(duration((2 * 60 + 4) * 60_000), "2h04m");
  assert.equal(duration((4 * 24 + 3) * 3_600_000), "4d3h");
  assert.equal(duration(-5), "0s");
});

test("a folder under home is shown from ~", () => {
  assert.equal(shortPath("/Users/me/app", "/Users/me"), "~/app");
  assert.equal(shortPath("/Users/me", "/Users/me"), "~");
  assert.equal(shortPath("/Users/meow/app", "/Users/me"), "/Users/meow/app");
  assert.equal(shortPath("/srv/api", null), "/srv/api");
  assert.equal(shortPath(null, "/Users/me"), "");
});

test("an error counts as blocked, and an unknown status as none", () => {
  assert.equal(statusOf("error"), "blocked");
  assert.equal(statusOf("starting"), null);
  assert.equal(statusOf(null), null);
});

test("the machine is the part of an address before the slash", () => {
  assert.equal(machineOf("studio/t7"), "studio");
  assert.equal(machineOf("t7"), null);
});
