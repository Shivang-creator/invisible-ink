// core/codepoints.js — pure. No imports from outside core/. No network, no model.
//
// toRecords(text) splits a string into one record per Unicode codepoint (an astral
// surrogate pair counts as one record, not two). `index` is the UTF-16 code-unit
// offset of that codepoint's first code unit — the same unit String.prototype.slice
// uses, so every offset this module (or anything downstream) prints is directly
// usable against the original string.

/**
 * @param {string} text
 * @returns {{cp:number, char:string, index:number, utf16len:number}[]}
 */
export function toRecords(text) {
  const records = [];
  let index = 0;
  // `for...of` on a string iterates by codepoint: it pairs a high/low surrogate
  // pair into a single iteration step, so this loop naturally counts astral
  // codepoints (e.g. the tag block, U+E0000-U+E007F) once each.
  for (const char of text) {
    const cp = char.codePointAt(0);
    const utf16len = char.length; // 1 for BMP codepoints, 2 for astral (surrogate pair)
    records.push({ cp, char, index, utf16len });
    index += utf16len;
  }
  return records;
}

/**
 * Total UTF-16 code units in the raw string — what the model actually receives.
 * @param {string} text
 * @returns {number}
 */
export function deliveredLength(text) {
  return text.length;
}

/**
 * Code units a human-facing renderer would show: every record's utf16len, minus
 * the ones a predicate marks as hidden/flagged. The predicate is supplied by the
 * caller (core/detect.js decides what "flagged" means, from the rulepack) — this
 * module knows nothing about rules.
 * @param {{utf16len:number}[]} records
 * @param {(record:object)=>boolean} isFlagged
 * @returns {number}
 */
export function visibleLength(records, isFlagged) {
  let total = 0;
  for (const record of records) {
    if (!isFlagged(record)) total += record.utf16len;
  }
  return total;
}
