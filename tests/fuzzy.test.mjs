import test from "node:test";
import assert from "node:assert/strict";
import { match, segments } from "../mods/bar/fuzzy.js";

const score = (term, text) => match(term, text)?.score ?? null;

test("a term matches as a subsequence, in order", () => {
  assert.deepEqual(match("fl", "fix login").positions, [0, 4]);
  assert.equal(match("lf", "fix login"), null);
  assert.equal(match("fixx", "fix"), null);
});

test("an empty term matches anything, an empty text nothing", () => {
  assert.deepEqual(match("", "anything"), { score: 0, positions: [] });
  assert.equal(match("a", ""), null);
});

test("lowercase ignores case, a capital asks for it", () => {
  assert.ok(match("login", "Fix Login"));
  assert.ok(match("Login", "Fix Login"));
  assert.equal(match("Login", "fix login"), null);
});

test("adjacent characters beat scattered ones", () => {
  assert.ok(score("log", "fix login") > score("log", "let old gears"));
});

test("word starts beat the middle of a word", () => {
  assert.ok(score("fl", "fix-login") > score("fl", "shuffle"));
  assert.ok(score("fL", "fixLogin") > score("fl", "baffle"));
});

test("a match near the start beats a later one", () => {
  assert.ok(score("api", "api server") > score("api", "the old api"));
});

test("the best alignment is found, not the first", () => {
  // The first "a" is in "data"; the run is in "api".
  assert.deepEqual(match("api", "data api").positions, [5, 6, 7]);
});

test("a long gap costs no more than a medium one", () => {
  const far = "a" + "x".repeat(40) + "b";
  const farther = "a" + "x".repeat(80) + "b";
  assert.equal(score("ab", far), score("ab", farther));
});

test("positions index the original text, non-ASCII included", () => {
  assert.deepEqual(match("ñu", "el ñu azul").positions, [3, 4]);
});

test("segments split a text into matched and unmatched runs", () => {
  assert.deepEqual(segments("fix login", [0, 4, 5]), [
    { text: "f", hit: true },
    { text: "ix ", hit: false },
    { text: "lo", hit: true },
    { text: "gin", hit: false },
  ]);
  assert.deepEqual(segments("plain"), [{ text: "plain", hit: false }]);
  assert.deepEqual(segments(""), []);
});
