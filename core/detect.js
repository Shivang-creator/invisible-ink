// core/detect.js — the engine. Pure function over (text, rulepack). No imports
// from outside core/, no network, no model. The rulepack decides what a finding
// is; this file only walks codepoints, matches them, and groups adjacent hits of
// the same rule into a single span.

import { toRecords } from "./codepoints.js";

// --- generic codepoint-range membership -------------------------------------

function inRanges(cp, ranges) {
  if (!ranges) return false;
  for (const [lo, hi] of ranges) {
    if (cp >= lo && cp <= hi) return true;
  }
  return false;
}

function ruleMatches(cp, rule) {
  if (rule.codepoints && rule.codepoints.includes(cp)) return true;
  if (inRanges(cp, rule.ranges)) return true;
  return false;
}

function findRule(cp, rules) {
  for (const rule of rules) {
    if (ruleMatches(cp, rule)) return rule;
  }
  return null;
}

// --- context exclusions ------------------------------------------------------
// A small handful of codepoints in the flagged sets are also legitimate in
// ordinary text (U+200D joins emoji into a family/couple sequence; U+FE0F picks
// the emoji presentation of the preceding character). The rulepack names which
// exclusion applies via `contextExclude`; the engine implements the one, shared,
// generic mechanism ("is this codepoint adjacent to something emoji-like") so
// the exception is still driven by data, not by a codepoint-specific branch.

// Common emoji-bearing blocks. Not exhaustive of all of Unicode's emoji
// annexes — exhaustive enough that the family-ZWJ and emoji-VS false-positive
// cases (and anything realistic like them) resolve correctly.
const EMOJI_RANGES = [
  [0x1f000, 0x1f0ff],
  [0x1f300, 0x1faff],
  [0x2600, 0x27bf],
  [0x1f1e6, 0x1f1ff],
  [0x2b00, 0x2bff],
];

function isEmojiLike(cp) {
  return inRanges(cp, EMOJI_RANGES);
}

const CONTEXT_EXCLUSIONS = {
  // U+200D ZWJ joining two emoji-like codepoints is a legitimate ZWJ sequence
  // (e.g. the family emoji), not a hidden zero-width payload.
  emojiZWJ(records, i) {
    const prev = records[i - 1];
    const next = records[i + 1];
    return Boolean(prev && next && isEmojiLike(prev.cp) && isEmojiLike(next.cp));
  },
  // U+FE0F immediately after an emoji-like codepoint is the standard "render as
  // emoji" presentation selector, not a smuggled byte.
  emojiVariationSelector(records, i) {
    const record = records[i];
    if (record.cp !== 0xfe0f) return false;
    const prev = records[i - 1];
    return Boolean(prev && isEmojiLike(prev.cp));
  },
};

function isExcluded(rule, records, i) {
  const name = rule.contextExclude;
  if (!name) return false;
  const check = CONTEXT_EXCLUSIONS[name];
  return check ? check(records, i) : false;
}

// --- decoding ------------------------------------------------------------

function decodeSpan(rule, codepoints) {
  switch (rule.decode) {
    case "tagblock":
      // TAG codepoints mirror ASCII 0x00-0x7F at a fixed offset (U+E0000).
      return codepoints.map((cp) => String.fromCharCode(cp - 0xe0000)).join("");
    case "homoglyph": {
      const targets = rule.targets || {};
      return codepoints
        .map((cp) => {
          if (Object.prototype.hasOwnProperty.call(targets, cp)) return targets[cp];
          if (typeof rule.rangeTargetOffset === "number" && inRanges(cp, rule.ranges)) {
            return String.fromCharCode(cp + rule.rangeTargetOffset);
          }
          return "?";
        })
        .join("");
    }
    case "variationselector":
      // Standardized VS (U+FE00-FE0F) encode as cp-0xFE00; the supplement block
      // (U+E0100-E01EF, the one actually used for byte-per-selector smuggling)
      // encodes as cp-0xE0100.
      return codepoints
        .map((cp) =>
          cp >= 0xe0100 ? String.fromCharCode(cp - 0xe0100) : String.fromCharCode(cp - 0xfe00)
        )
        .join("");
    default:
      return null;
  }
}

/**
 * @param {string} text
 * @param {{version:string, rules:object[]}} rulepack
 * @returns {{visibleLength:number, deliveredLength:number, codepointCount:number,
 *   findings:object[], byRule:object, rulepackVersion:string}}
 */
export function analyze(text, rulepack) {
  const records = toRecords(text);
  const rules = rulepack.rules;
  const findings = [];
  const byRule = {};

  let current = null; // {rule, startIndex, endIndex, codepoints[]}

  const flush = () => {
    if (!current) return;
    const rule = current.rule;
    byRule[rule.id] = (byRule[rule.id] || 0) + 1;
    findings.push({
      ruleId: rule.id,
      class: rule.class,
      start: current.startIndex,
      end: current.endIndex,
      codepoints: current.codepoints,
      decoded: decodeSpan(rule, current.codepoints),
      severity: rule.severity,
      citation: rule.citation,
    });
    current = null;
  };

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const rule = findRule(record.cp, rules);
    const matched = rule && !isExcluded(rule, records, i);

    if (matched) {
      if (current && current.rule.id === rule.id && current.endIndex === record.index) {
        current.endIndex = record.index + record.utf16len;
        current.codepoints.push(record.cp);
      } else {
        flush();
        current = {
          rule,
          startIndex: record.index,
          endIndex: record.index + record.utf16len,
          codepoints: [record.cp],
        };
      }
    } else {
      flush();
    }
  }
  flush();

  const deliveredLength = text.length;
  const flaggedUnits = findings.reduce((sum, f) => sum + (f.end - f.start), 0);
  const visibleLength = deliveredLength - flaggedUnits;

  return {
    visibleLength,
    deliveredLength,
    codepointCount: records.length,
    findings,
    byRule,
    rulepackVersion: rulepack.version,
  };
}
