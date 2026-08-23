#!/usr/bin/env node
// tools/killswitch.mjs — the kill-switch proof, as a script. Same guarantee as
// the in-app Kill-Switch Proof panel (ui/killSwitch.js renders that one),
// provable here in one command with no browser involved.
//
// R-03 (2026-08-24, pc-red-team): this file used to compute buildLedgerHash
// on the SAME input twice — once "with the model layer loaded", once "with
// it stubbed" — and print both as if two different things had been
// compared. They hadn't: buildLedgerHash never accepted an explanations
// argument, so nothing was ever stubbed. That is a structural fact dressed
// up as a measured experiment, and it is exactly the "delay loop sold as
// thinking" shape a hostile reader looks for. Fixed without rebuilding
// anything: this script now (1) states the structural fact plainly and
// proves it by inspecting the function's own arity, and (2) runs the one
// real two-condition comparison a CLI *can* run — two genuinely different
// input texts — to prove the hash is a real, discriminating function of its
// input, not a constant. The other real comparison this build has (the
// explanation-layer toggle actually flipped, Ledger DOM hashed each state)
// needs a DOM, so it lives in the browser — see the in-app "Prove identical"
// button and tests/killswitch.test.js.

import { analyze } from "../core/detect.js";
import { sanitize } from "../core/sanitize.js";
import { canonicalJSON } from "../core/canonical.js";
import { sha256Hex } from "../core/hash.js";
import rulepack from "../data/rulepack.v1.js";
import { poisonedReadme, jobDescription } from "../data/samples.js";

/**
 * Build the canonical Ledger representation for a piece of text and hash it.
 * Deliberately takes exactly 2 parameters, no `explanations` argument: the
 * explanation layer's prose has no path into this function. That is the
 * guarantee itself, provable by reading `buildLedgerHash.length` below, not
 * a claim about it.
 * @param {string} text
 * @param {object} rp
 * @returns {Promise<string>} hex SHA-256 digest
 */
export async function buildLedgerHash(text, rp) {
  const report = analyze(text, rp);
  const { clean } = sanitize(text, report);
  const ledger = {
    findings: report.findings,
    byRule: report.byRule,
    visibleLength: report.visibleLength,
    deliveredLength: report.deliveredLength,
    codepointCount: report.codepointCount,
    rulepackVersion: report.rulepackVersion,
    clean,
  };
  return sha256Hex(canonicalJSON(ledger));
}

async function loadExplanationsOrStub() {
  try {
    const mod = await import("../data/explanations.js");
    return mod.default ?? {};
  } catch {
    // Not shipped, or removed by the death order (T-16/T-17 are optional by
    // construction) -- an empty stub is the correct fallback, not a crash.
    return {};
  }
}

async function main() {
  const hash = await buildLedgerHash(poisonedReadme, rulepack);
  console.log(`Ledger hash (findings + sanitized output, SHA-256): ${hash}`);

  console.log(
    `buildLedgerHash(text, rulepack) takes ${buildLedgerHash.length} parameters -- there is no explanations argument for a model layer to reach through. Structural, not measured.`
  );

  const explanations = await loadExplanationsOrStub();
  const ruleCount = Object.keys(explanations.byRule || {}).length;
  console.log(
    `data/explanations.js currently holds ${ruleCount} rule explanation(s) (source: ${explanations.source || "n/a"}). Loading it changed nothing above, because nothing above ever reads it.`
  );

  // The one real two-condition comparison a CLI can run: two genuinely
  // different inputs, not the same input hashed twice. If this ever came
  // back equal, buildLedgerHash would be a constant function and every claim
  // built on it would be meaningless.
  const hashA = await buildLedgerHash(poisonedReadme, rulepack);
  const hashB = await buildLedgerHash(jobDescription, rulepack);
  const discriminates = hashA !== hashB;
  console.log(
    `Different input, different hash: poisonedReadme != jobDescription -> ${discriminates ? "DIFFERENT (expected)" : "IDENTICAL (bug)"}`
  );

  console.log(
    "The toggle-flip / Ledger-DOM proof needs a browser -- press \"Prove identical\" in the app, or see tests/killswitch.test.js."
  );

  if (discriminates) {
    console.log("STRUCTURALLY SOUND");
    process.exit(0);
  } else {
    console.error("MISMATCH — buildLedgerHash did not distinguish two different inputs. This must never happen.");
    process.exit(1);
  }
}

// Only run as a CLI when executed directly (`node tools/killswitch.mjs` /
// `npm run killswitch`), never when another module imports buildLedgerHash
// from this file -- tests/killswitch.test.js does exactly that, and an
// unconditional main() here would call process.exit() during import and
// silently swallow every test in that file.
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main();
}
