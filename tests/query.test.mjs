import test from "node:test";
import assert from "node:assert/strict";
import { parse, filter, passes, without, pill } from "../mods/bar/query.js";

const row = (extra) => ({ kind: "agent", status: "idle", machine: null, space: "app", program: { key: "claude", name: "Claude Code" }, ...extra });

test("a leading sign picks a list and is not a search word", () => {
  for (const [q, scope] of [["@ fix", "agents"], ["!", "blocked"], ["$x", "tabs"], ["%", "panes"], ["# api", "spaces"], ["> zoom", "commands"]]) {
    assert.equal(parse(q).scope, scope, q);
  }
  assert.deepEqual(parse("@ fix login").terms, ["fix", "login"]);
  assert.equal(parse("fix @home").scope, null, "a sign counts only first");
});

test("a lone ? asks for the cheat sheet", () => {
  assert.equal(parse("?").scope, "help");
  assert.equal(parse(" ? ").scope, "help");
  assert.equal(parse("why?").scope, null);
});

test("filter words come out of the search words, wherever they are", () => {
  const p = parse("login on:studio -is:idle fix");
  assert.deepEqual(p.terms, ["login", "fix"]);
  assert.equal(p.text, "login fix");
  assert.deepEqual(p.filters.map((f) => [f.key, f.value, f.neg, f.valid]), [["on", "studio", false, true], ["is", "idle", true, true]]);
});

test("a word with a colon that is not a filter stays a search word", () => {
  assert.deepEqual(parse("http://x a:b").terms, ["http://x", "a:b"]);
});

test("a filter still being typed, or one is: doesn't know, filters nothing", () => {
  const p = parse("on: is:whatever");
  assert.deepEqual(p.filters.map((f) => f.valid), [false, false]);
  assert.equal(filter([row()], p.filters).length, 1);
});

test("quoted values may hold spaces", () => {
  const [f] = parse('in:"my app" x').filters;
  assert.equal(f.value, "my app");
});

test("is: knows statuses, kinds and marks", () => {
  const f = (q) => parse(q).filters[0];
  assert.ok(passes(row({ status: "blocked" }), f("is:needs")));
  assert.ok(passes(row({ pinned: true }), f("is:pinned")));
  assert.ok(passes(row({ sub: true }), f("is:sub")));
  assert.ok(passes(row({ kind: "tab" }), f("is:tab")));
  assert.ok(!passes(row({ status: "working" }), f("is:idle")));
  assert.ok(passes(row({ status: "working" }), f("-is:idle")));
});

test("on: matches a machine by part of its name; local means this computer", () => {
  const f = (q) => parse(q).filters[0];
  assert.ok(passes(row({ machine: "studio" }), f("on:stu")));
  assert.ok(!passes(row({ machine: "studio" }), f("on:local")));
  assert.ok(passes(row({ machine: null }), f("on:local")));
  assert.ok(passes(row({ machine: null }), f("on:here")));
});

test("in: matches the space, app: the program", () => {
  const f = (q) => parse(q).filters[0];
  assert.ok(passes(row({ space: "Checkout API" }), f("in:api")));
  assert.ok(passes(row(), f("app:claude")));
  assert.ok(passes(row(), f("app:code")));
  assert.ok(!passes(row(), f("app:codex")));
});

test("taking a filter out leaves the rest as typed", () => {
  const q = "@ login on:studio fix";
  assert.equal(without(q, parse(q).filters[0]), "@ login fix");
  assert.equal(without("on:studio", parse("on:studio").filters[0]), "");
});

test("a filter's pill reads as words", () => {
  assert.equal(pill(parse("on:studio").filters[0]), "on studio");
  assert.equal(pill(parse("-is:idle").filters[0]), "not idle");
  assert.equal(pill(parse("on:").filters[0]), "on …");
});
