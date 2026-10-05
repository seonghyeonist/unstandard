import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(`${process.cwd()}/package.json`);
const braces = require("braces") as (pattern: string) => string[];

test("braces rejects input deeper than the safe parser limit", () => {
  for (const [label, open, close] of [
    ["brace", "{", "}"],
    ["parenthesis", "(", ")"],
  ] as const) {
    const atLimit = open.repeat(100) + "x" + close.repeat(100);
    const overLimit = open.repeat(101) + "x" + close.repeat(101);

    assert.doesNotThrow(() => braces(atLimit), `${label} depth 100 remains supported`);
    assert.throws(
      () => braces(overLimit),
      /exceeds max depth \(100\)/,
      `${label} depth 101 is rejected before recursive traversal`,
    );
  }
});
