// Presentation order follows the questionnaire. Ranking uses lexical IDs.
export const axes = /** @type {const} */ (["pace", "boundary", "expression", "reality", "commitment", "confidence"]);
export const minScore = -5;
export const maxScore = 5;

/** @typedef {(typeof axes)[number]} Axis */
/** @typedef {Record<Axis, number>} Scores */

/** @param {unknown} value */
export function isScore(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= minScore && value <= maxScore;
}

/** @param {string} value */
export function parseScore(value) {
  return /^(?:0|-?[1-5])$/.test(value) ? Number(value) : NaN;
}

/** @param {unknown} input */
export function rankReceipt(input) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new TypeError("Expected six axis scores");
  }
  const scores = /** @type {Record<string, unknown>} */ (input);
  if (Reflect.ownKeys(scores).length !== axes.length ||
      !axes.every((axis) => Object.hasOwn(scores, axis) && isScore(scores[axis]))) {
    throw new TypeError("Expected an integer from -5 to +5 for each axis");
  }
  const ranked = axes.map((axis) => ({ axis, score: /** @type {number} */ (scores[axis]) }));
  ranked.sort((a, b) => {
    const magnitude = Math.abs(b.score) - Math.abs(a.score);
    if (magnitude !== 0) return magnitude;
    if (a.axis === b.axis) return 0;
    return a.axis < b.axis ? -1 : 1;
  });
  return { allNeutral: ranked.every(({ score }) => score === 0), top: ranked.slice(0, 2) };
}

/** @param {number} score */
export function formatScore(score) {
  if (score < 0) return "−" + Math.abs(score);
  return score > 0 ? "+" + score : "0";
}
