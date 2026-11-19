import { test } from "node:test";
import assert from "node:assert/strict";
import { axes, parseScore, rankReceipt } from "../src/receipt.mjs";
import { renderPage } from "../src/view.mjs";

const neutral = Object.fromEntries(axes.map((axis) => [axis, 0]));

test("accepts both boundaries and ranks magnitude independently of sign", () => {
  const {top} = rankReceipt({...neutral, pace: -5, boundary: 5, confidence: -4});
  assert.deepEqual(top, [{axis: "boundary", score: 5}, {axis: "pace", score: -5}]);
});

test("resolves ties by axis ID regardless of presentation order", () => {
  const scores = {...neutral, pace: 3, expression: -3, confidence: 3};
  assert.deepEqual(rankReceipt(scores).top.map(({axis}) => axis), ["confidence", "expression"]);
});

test("all zeros yield two stable neutral axes", () => {
  assert.deepEqual(rankReceipt(neutral), {
    allNeutral: true, top: [{axis: "boundary", score: 0}, {axis: "commitment", score: 0}],
  });
});

test("rejects malformed records and invalid score values", () => {
  const invalid = [undefined, null, [], {}, {...neutral, fake: 1}, Object.create(neutral)];
  invalid.push(...[-6, 6, -1.5, NaN, Infinity, true, null, "2"].map((pace) => ({...neutral, pace})));
  for (const input of invalid) assert.throws(() => rankReceipt(input), TypeError);
});

test("parses only the canonical option values", () => {
  for (let score = -5; score <= 5; score += 1) assert.equal(parseScore(String(score)), score);
  for (const value of ["", " 0 ", "05", "5.0", "1e0", "−1", "-0", "+1", "6", "-6"]) {
    assert.ok(Number.isNaN(parseScore(value)));
  }
});

test("both localizations display the same results and counts", () => {
  const scores = {...neutral, pace: 5, confidence: -5};
  const receipt = rankReceipt(scores);
  const ranks = (locale) => [...renderPage(locale, scores, receipt, true)
    .matchAll(/data-axis="([^"]+)"><span class="score">([^<]+)/g)].map((match) => match.slice(1));
  assert.deepEqual(ranks("ko"), [["confidence", "−5"], ["pace", "+5"]]);
  assert.deepEqual(ranks("en"), ranks("ko"));
  assert.match(renderPage("en", {pace: 3}, null, true), /1 of 6 answered/);
  assert.match(renderPage("ko", {pace: 3}, null, true), /6개 중 1개 응답/);
});
