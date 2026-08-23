// ui/modelLayer.js — the explanation layer's only door into the UI: reads
// data/explanations.js (per-rule prose, optional by construction — T-16/T-17
// never ran tonight, so this is real human-written RULE prose, not model
// output; see data/explanations.js's own header) and tracks the header
// ON/OFF toggle. Holds no verdict logic: getExplanation returns a string or
// undefined, never a decision, and nothing here ever touches a Report, a
// finding or an offset.
//
// The toggle itself is CSS-only: setOn writes a data-model attribute on the
// document root and nothing else. No re-render follows from it, which is why
// a screenshot diff of the Ledger region before/after toggling shows zero
// change by construction, not by care taken at call sites.

let explanations = {};
let modelOn = true;

/**
 * Load data/explanations.js if it exists. Uses import().catch() rather than
 * a bare static import so a missing or not-yet-generated file degrades to an
 * empty prose set instead of breaking the module graph — the same pattern
 * tools/killswitch.mjs already uses for the same file.
 * @returns {Promise<object>}
 */
export async function loadExplanations() {
  try {
    const mod = await import("../data/explanations.js");
    const payload = mod && mod.default ? mod.default : {};
    explanations = payload.byRule || payload || {};
  } catch (err) {
    console.warn(
      "data/explanations.js is not present (T-16/T-17 may not have run, or it was cut by the freeze death order). " +
        "Per-rule prose degrades to nothing generated; every other number on this page is unaffected.",
      err
    );
    explanations = {};
  }
  return explanations;
}

/** @param {string} ruleId @returns {string|undefined} */
export function getExplanation(ruleId) {
  return explanations[ruleId];
}

export function hasAnyExplanations() {
  return Object.keys(explanations).length > 0;
}

export function isOn() {
  return modelOn;
}

/** @param {boolean} on */
export function setOn(on) {
  modelOn = Boolean(on);
  document.documentElement.dataset.model = modelOn ? "on" : "off";
}
