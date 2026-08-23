// tests/corpus.test.js — one test() per data/corpus.js case, asserting the exact
// rule-ID set and the exact offsets (and decoded payload where the fixture
// specifies one), not merely "something was found". Written to iterate the
// corpus dynamically: it does not hardcode a case count, so appending fixtures
// (e.g. the VS-001 migration in T-14) raises the count with no edit here.

import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../core/detect.js";
import rulepack from "../data/rulepack.v1.js";
import corpus from "../data/corpus.js";

for (const testCase of corpus.cases) {
  test(`corpus ${testCase.id}: ${testCase.description}`, () => {
    const report = analyze(testCase.text, rulepack);

    if (testCase.class === "benign" || testCase.class === "known-miss") {
      assert.deepEqual(
        report.findings,
        [],
        `expected 0 findings for ${testCase.id}, got ${report.findings.length}`
      );
      return;
    }

    assert.equal(
      report.findings.length,
      testCase.expected.length,
      `${testCase.id}: expected ${testCase.expected.length} findings, got ${report.findings.length}`
    );

    for (const expected of testCase.expected) {
      const match = report.findings.find(
        (f) => f.ruleId === expected.ruleId && f.start === expected.start && f.end === expected.end
      );
      assert.ok(
        match,
        `${testCase.id}: no finding matched {ruleId:${expected.ruleId}, start:${expected.start}, end:${expected.end}}; got ${JSON.stringify(
          report.findings.map((f) => ({ ruleId: f.ruleId, start: f.start, end: f.end }))
        )}`
      );
      if (expected.decoded !== undefined) {
        assert.equal(match.decoded, expected.decoded, `${testCase.id}: decoded payload mismatch`);
      }
    }
  });
}

test("corpus.js exposes its generating seed and case count is nonzero", () => {
  assert.equal(typeof corpus.seed, "number");
  assert.ok(corpus.cases.length > 0);
});
