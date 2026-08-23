import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../core/detect.js";
import rulepack from "../data/rulepack.v1.js";
import { knownMiss } from "../data/samples.js";
import knownMissDoc from "../data/known-miss.js";

test("test_known_miss_base64_remains_undetected", () => {
  // This is a TESTED property, not an accident: the shipped Known Miss sample
  // must produce exactly zero findings. If a future rulepack change ever
  // starts flagging it, this test fails loudly rather than silently claiming
  // coverage we do not have.
  const report = analyze(knownMiss, rulepack);
  assert.equal(report.findings.length, 0);
});

test("the known-miss sample itself decodes to a real hidden instruction", () => {
  // Sanity check on the fixture: prove the base64 substring genuinely decodes
  // to an instruction (so the miss is a real one, not a decoy).
  const match = knownMiss.match(/([A-Za-z0-9+/]+={0,2})\s*\(/);
  assert.ok(match, "expected a base64 token in the known-miss sample");
  const decoded = Buffer.from(match[1], "base64").toString("utf8");
  assert.match(decoded, /instructions/);
});

test("data/known-miss.js documents the two out-of-scope attack classes", () => {
  // Still exactly 2: these are the false-NEGATIVE classes (things this
  // detector cannot see at all). R-10's false-POSITIVE disclosure below is a
  // deliberately separate field, not a third entry here -- over-firing on
  // legitimate text is a different failure direction from missing a hidden
  // one, and conflating them would blur what each list is claiming.
  assert.equal(knownMissDoc.outOfScope.length, 2);
  assert.ok(knownMissDoc.summary.length > 0);
});

test("test_known_miss_panel_discloses_the_false_positive_direction", () => {
  // R-10 (2026-08-24, pc-red-team): the panel used to disclose only where
  // this detector misses, never where it over-fires. This pins the
  // disclosure's existence and content; tests/falsepositive.test.js pins the
  // actual behaviour it describes (the exact finding counts on real
  // Cyrillic/Greek/Devanagari/NBSP text).
  assert.ok(
    typeof knownMissDoc.overReporting === "string" && knownMissDoc.overReporting.length > 0,
    "expected data/known-miss.js to disclose the false-positive direction"
  );
  assert.match(knownMissDoc.overReporting, /HG-001/);
  assert.match(knownMissDoc.overReporting, /Cyrillic/);
});
