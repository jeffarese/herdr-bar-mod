// Fuzzy matching: does a typed term appear in a text, in order, and how well.
// No app imports here, so `node --test` can run it.

const BASE = 16; // each matched character
const BOUNDARY = 12; // at the start of a word ("fl" in "fix-login")
const CAMEL = 10; // at a capital inside a word ("L" in "fixLogin")
const START = 8; // at the very start of the text, on top of BOUNDARY
const RUN = 14; // right after the previous matched character
const GAP = 2; // per skipped character between two matches
const GAP_MAX = 20; // a long gap costs no more than this
const LEAD = 1; // per character before the first match
const LEAD_MAX = 6;

const isWord = (c) => /[\p{L}\p{N}]/u.test(c);
const isUpper = (c) => c !== c.toLowerCase();

// What matching at text[j] is worth on its own.
function bonus(text, j) {
  if (j === 0) return BOUNDARY + START;
  const prev = text[j - 1];
  if (!isWord(prev)) return isWord(text[j]) ? BOUNDARY : 0;
  return isUpper(text[j]) && !isUpper(prev) ? CAMEL : 0;
}

/**
 * Matches `term` against `text` as a subsequence and returns the best alignment, or null when
 * the characters are not all there in order.
 *
 * Returns { score, positions }: `positions` are the indexes in `text` that matched, in order,
 * for highlighting. A higher score is a better match: runs of adjacent characters, word starts
 * and matches near the beginning are preferred. A term with a capital letter matches case as
 * typed; an all-lowercase term ignores case.
 */
export function match(term, text) {
  if (!term) return { score: 0, positions: [] };
  if (!text || term.length > text.length) return null;
  const exact = term !== term.toLowerCase();
  const hay = exact ? text : text.toLowerCase();
  const n = term.length;
  const m = hay.length;

  // Cheap way out: most rows don't match most terms.
  for (let i = 0, j = 0; i < n; i++, j++) {
    j = hay.indexOf(term[i], j);
    if (j < 0) return null;
  }

  // best[i][j]: the best score with term[i] matched at text[j]; from[i][j]: where term[i - 1] was.
  const best = [];
  const from = [];
  for (let i = 0; i < n; i++) {
    best.push(new Array(m).fill(-Infinity));
    from.push(new Array(m).fill(-1));
    // The best place for term[i - 1] with at least one character skipped before j. A gap costs
    // GAP per character up to GAP_MAX, so the best is the larger of two running maxima: one
    // that loses GAP at every step, and one that pays GAP_MAX whatever the distance.
    let near = -Infinity;
    let nearAt = -1;
    let far = -Infinity;
    let farAt = -1;
    for (let j = i; j < m; j++) {
      if (i > 0 && j > 1) {
        const left = best[i - 1][j - 2];
        near -= GAP;
        if (left - GAP >= near) {
          near = left - GAP;
          nearAt = j - 2;
        }
        if (left - GAP_MAX > far) {
          far = left - GAP_MAX;
          farAt = j - 2;
        }
      }
      if (hay[j] !== term[i]) continue;
      const own = BASE + bonus(text, j);
      if (i === 0) {
        best[i][j] = own - Math.min(LEAD_MAX, j * LEAD);
        continue;
      }
      const adjacent = best[i - 1][j - 1] + RUN;
      const [gapped, gappedAt] = near >= far ? [near, nearAt] : [far, farAt];
      if (adjacent === -Infinity && gapped === -Infinity) continue;
      if (adjacent >= gapped) {
        best[i][j] = adjacent + own;
        from[i][j] = j - 1;
      } else {
        best[i][j] = gapped + own;
        from[i][j] = gappedAt;
      }
    }
  }

  let end = -1;
  for (let j = n - 1; j < m; j++) if (best[n - 1][j] > (end < 0 ? -Infinity : best[n - 1][end])) end = j;
  if (end < 0) return null;
  const positions = new Array(n);
  for (let i = n - 1, j = end; i >= 0; j = from[i][j], i--) positions[i] = j;
  return { score: best[n - 1][end], positions };
}

/**
 * Splits `text` into runs for drawing: [{ text, hit }], `hit` true for the matched characters.
 * `positions` are sorted indexes into `text`, as `match` returns them.
 */
export function segments(text, positions = []) {
  const out = [];
  const hits = new Set(positions);
  for (let i = 0; i < text.length; i++) {
    const hit = hits.has(i);
    const last = out[out.length - 1];
    if (last && last.hit === hit) last.text += text[i];
    else out.push({ text: text[i], hit });
  }
  return out;
}
