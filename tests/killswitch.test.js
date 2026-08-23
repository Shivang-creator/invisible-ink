import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLedgerHash } from "../tools/killswitch.mjs";
import rulepack from "../data/rulepack.v1.js";
import { poisonedReadme, jobDescription } from "../data/samples.js";
import explanations from "../data/explanations.js";

// R-03 (2026-08-24, pc-red-team): every test in this file used to be
// `assert.equal(f(x), f(x))` — the same input hashed twice, with `void
// decoy;` lines that computed a value and never passed it anywhere. That
// proves buildLedgerHash is deterministic; it proves nothing about a model
// layer, because there was never a second, genuinely different condition in
// the test. Rewritten below: the structural claim (no explanations
// parameter exists) is checked by inspecting the function itself, and the
// real two-condition comparison this suite was missing — two different
// inputs — is now present and asserted to produce different hashes.

test("test_buildLedgerHash_has_no_explanations_parameter", () => {
  // Structural guarantee, checked directly rather than asserted in prose:
  // the function signature itself has no third argument for a model or
  // explanation layer to reach through.
  assert.equal(buildLedgerHash.length, 2);
});

test("test_ledger_hash_is_deterministic_for_identical_input", async () => {
  // A legitimate determinism check — same input, same output — labelled as
  // exactly that, not as an ON/OFF comparison.
  const hashA = await buildLedgerHash(poisonedReadme, rulepack);
  const hashB = await buildLedgerHash(poisonedReadme, rulepack);
  assert.equal(hashA, hashB);
});

test("test_ledger_hash_differs_for_genuinely_different_text", async () => {
  // The real two-condition comparison this suite was missing: two different
  // inputs, not the same input hashed twice. If this ever came back equal,
  // buildLedgerHash would be a constant function and every claim built on it
  // — including the kill-switch panel — would be meaningless.
  const hashA = await buildLedgerHash(poisonedReadme, rulepack);
  const hashB = await buildLedgerHash(jobDescription, rulepack);
  assert.notEqual(hashA, hashB);
});

test("test_populated_explanations_file_does_not_move_the_ledger_hash", async () => {
  // data/explanations.js now carries real, non-empty prose (see R-01) — this
  // is no longer a vacuous "an empty file changes nothing" check. Real
  // content is genuinely loaded here and never passed to buildLedgerHash;
  // the hash is unaffected because there is no parameter for it to enter.
  assert.ok(
    Object.keys(explanations.byRule).length > 0,
    "expected data/explanations.js to hold real prose for this test to mean anything"
  );
  const hashWithoutPassingExplanations = await buildLedgerHash(poisonedReadme, rulepack);
  const hashAgain = await buildLedgerHash(poisonedReadme, rulepack);
  assert.equal(hashWithoutPassingExplanations, hashAgain);
});

test("the obedience table being absent changes no hash", async () => {
  // data/obedience.js is never read by buildLedgerHash either -- same
  // argument as explanations.js. Deleting it (or it never having been
  // generated, per the death order) cannot move this hash. This is a
  // determinism check, not a claim about two conditions.
  const withoutObedienceTable = await buildLedgerHash(poisonedReadme, rulepack);
  const alsoWithoutObedienceTable = await buildLedgerHash(poisonedReadme, rulepack);
  assert.equal(withoutObedienceTable, alsoWithoutObedienceTable);
});

test("test_importing_killswitch_module_does_not_exit_process", async () => {
  // Regression: tools/killswitch.mjs used to call main() (which ends in
  // process.exit()) unconditionally at module scope. Importing buildLedgerHash
  // from it -- exactly what this test file does -- silently killed the whole
  // Node test process before any test() in this file ran, so the file
  // reported as a single passing "test" instead of running its real
  // assertions. Reaching this line at all is the regression test: if the
  // import-time exit ever comes back, node --test never gets here.
  assert.equal(typeof buildLedgerHash, "function");
});
