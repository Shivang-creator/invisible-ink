// core/sanitize.js — pure. No imports from outside core/, no network, no model.
//
// sanitize(text, report) removes exactly the spans report.findings names, in
// reverse offset order so earlier removals never invalidate a later offset.
// Homoglyphs are *replaced* with their decoded ASCII target (the visible letter
// stays, the confusable does not); every other class is deleted outright.
// Contract: idempotent — sanitize(sanitize(x).clean is re-analyzed) yields the
// same clean text again, because after removal nothing flagged remains.

/**
 * @param {string} text
 * @param {{findings: {ruleId:string, class:string, start:number, end:number, decoded:string|null}[]}} report
 * @returns {{clean:string, removed:object[]}}
 */
export function sanitize(text, report) {
  const findings = report.findings || [];
  // Reverse offset order: sort by start descending so removing/replacing a span
  // never shifts the start/end offsets of a span we have not processed yet.
  const ordered = [...findings].sort((a, b) => b.start - a.start);

  let clean = text;
  const removed = [];

  for (const finding of ordered) {
    const original = clean.slice(finding.start, finding.end);
    const isHomoglyph = finding.class === "HG";
    const replacement = isHomoglyph && finding.decoded ? finding.decoded : "";
    clean = clean.slice(0, finding.start) + replacement + clean.slice(finding.end);
    removed.push({
      ruleId: finding.ruleId,
      class: finding.class,
      start: finding.start,
      end: finding.end,
      original,
      replacement,
    });
  }

  // removed[] was built in reverse-offset order (last-in-text first); present it
  // in forward reading order so callers can reconstruct the original left-to-right.
  removed.reverse();

  return { clean, removed };
}
