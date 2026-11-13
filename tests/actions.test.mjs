import test from "node:test";
import assert from "node:assert/strict";
import { actionsFor, run, leaves } from "../mods/bar/actions.js";

const agent = { kind: "agent", key: "a:t1", terminal: "t1", pane: "p1", tab: "tb1", spaceId: "s1", pinned: false, settled: false };
const ids = (r) => actionsFor(r).map((a) => a.id);

test("an agent can be gone to, peeked, renamed, pinned, zoomed, settled and closed", () => {
  assert.deepEqual(ids(agent), ["go", "peek", "rename", "pin", "zoom", "settle", "close"]);
  assert.deepEqual(ids({ ...agent, pinned: true, settled: true }), ["go", "peek", "rename", "unpin", "zoom", "unsettle", "close"]);
});

test("a sub-agent has no pane: peek, a tab of its own, or end it", () => {
  assert.deepEqual(ids({ ...agent, sub: true, pane: null }), ["go", "keep", "close"]);
  assert.deepEqual(run("close", { ...agent, sub: true }), ["terminal.kill", { terminal: "t1" }]);
});

test("a space, a pane and a command each have their own", () => {
  assert.deepEqual(ids({ kind: "space", spaceId: "s1" }), ["go", "new-tab", "rename", "close"]);
  assert.deepEqual(ids({ kind: "pane", terminal: "t2", pane: "p2", tab: "tb1" }), ["go", "peek", "rename", "zoom", "settle", "close"]);
  assert.deepEqual(ids({ kind: "command" }), ["go"]);
  assert.deepEqual(ids(null), []);
});

test("actions run the app's commands with the row's ids", () => {
  assert.deepEqual(run("pin", agent), ["terminal.pin", { terminal: "t1", pinned: true }]);
  assert.deepEqual(run("settle", agent), ["tab.settle", { id: "tb1" }]);
  assert.deepEqual(run("close", agent), ["tab.close", { id: "tb1", confirmed: true }]);
  assert.deepEqual(run("close", { kind: "space", spaceId: "s1" }), ["space.close", { id: "s1", confirmed: true }]);
  assert.deepEqual(run("close", { kind: "pane", pane: "p2" }), ["pane.close", { pane: "p2" }]);
  assert.deepEqual(run("new-tab", { kind: "space", spaceId: "s1" }), ["tab.new", { space: "s1" }]);
  assert.equal(run("go", agent), null);
});

test("going somewhere leaves the bar; marking a row does not", () => {
  assert.ok(leaves("peek"));
  assert.ok(!leaves("pin"));
  assert.ok(!leaves("settle"));
});
