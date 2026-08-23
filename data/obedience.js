// data/obedience.js -- PLACEHOLDER. Not yet run.
//
// The real file is produced by tools/run-obedience.mjs (T-16, owned by
// pc-integrator, hard 25-minute time box): 8 arms x 3 host documents x 5
// repetitions against a live model, graded by a deterministic substring
// check for a canary token. No model ID is named here because that task
// never ran -- nobody has verified any model ID against the vendor's current
// docs (see .crew/DECISIONS.md, R-01/R-02), so none is printed as if it had.
// That task had not run yet when the frontend
// (T-20..T-23) needed this module to exist. This is exactly the shape
// BOARD.md T-16 itself specifies for the zero-usable-cells case: "If the run
// produces zero usable cells, write export default
// Object.freeze({cells:[], ranAt:null}) and log it -- the panel then hides
// itself (T-22) and the claim is dropped from both writeups." ui/obedience.js
// already implements that hide-on-empty behavior, tested by removing this
// exact shape from the DOM rather than rendering an empty table.
//
// tools/run-obedience.mjs overwrites this file in place with real, cached
// model-run data; nothing here is a claim about model behavior. See
// .crew/DECISIONS.md (pc-frontend, T-20..T-23 session) for the reasoning.

export default Object.freeze({
  cells: [],
  ranAt: null
});
