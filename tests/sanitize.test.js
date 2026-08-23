import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../core/detect.js";
import { sanitize } from "../core/sanitize.js";
import rulepack from "../data/rulepack.v1.js";

function tagEncode(msg) {
  return [...msg].map((ch) => String.fromCodePoint(0xe0000 + ch.charCodeAt(0))).join("");
}

test("sanitize removes a zero-width payload entirely", () => {
  const text = "hi" + String.fromCodePoint(0x200b) + "there";
  const report = analyze(text, rulepack);
  const { clean } = sanitize(text, report);
  assert.equal(clean, "hithere");
});

test("sanitize removes a tag-block payload entirely", () => {
  const text = "safe" + tagEncode("hi") + "text";
  const report = analyze(text, rulepack);
  const { clean } = sanitize(text, report);
  assert.equal(clean, "safetext");
});

test("sanitize removes a bidi override codepoint entirely", () => {
  const text = "a" + String.fromCodePoint(0x202e) + "b";
  const report = analyze(text, rulepack);
  const { clean } = sanitize(text, report);
  assert.equal(clean, "ab");
});

test("sanitize removes unusual whitespace entirely", () => {
  const text = "a" + String.fromCodePoint(0x00a0) + "b";
  const report = analyze(text, rulepack);
  const { clean } = sanitize(text, report);
  assert.equal(clean, "ab");
});

test("sanitize replaces a homoglyph with its ASCII target instead of deleting it", () => {
  const cyrillicA = String.fromCodePoint(0x0430);
  const text = "p" + cyrillicA + "ypal.com";
  const report = analyze(text, rulepack);
  const { clean } = sanitize(text, report);
  assert.equal(clean, "paypal.com");
});

test("sanitize leaves benign text byte-identical to the input", () => {
  const text = "an entirely ordinary sentence with nothing hidden in it.";
  const report = analyze(text, rulepack);
  const { clean, removed } = sanitize(text, report);
  assert.equal(clean, text);
  assert.deepEqual(removed, []);
});

test("test_sanitize_is_idempotent", () => {
  const cyrillicA = String.fromCodePoint(0x0430);
  const text = "safe" + tagEncode("hi") + " p" + cyrillicA + "ypal " + String.fromCodePoint(0x200b) + "end";
  const first = analyze(text, rulepack);
  const { clean: cleanOnce } = sanitize(text, first);
  const second = analyze(cleanOnce, rulepack);
  const { clean: cleanTwice } = sanitize(cleanOnce, second);
  assert.equal(cleanTwice, cleanOnce);
});

test("legitimate family-emoji ZWJ sequence survives sanitize unchanged", () => {
  const family =
    String.fromCodePoint(0x1f468) +
    String.fromCodePoint(0x200d) +
    String.fromCodePoint(0x1f469) +
    String.fromCodePoint(0x200d) +
    String.fromCodePoint(0x1f467);
  const report = analyze(family, rulepack);
  const { clean } = sanitize(family, report);
  assert.equal(clean, family);
});

test("test_reverse_offset_removal_keeps_later_offsets_valid", () => {
  // Two independent findings at different offsets in the same string; sanitize
  // must apply the removal in an order that never invalidates the *other*
  // finding's offset (removing left-to-right would shift everything after the
  // first removal).
  const text =
    "aaa" + String.fromCodePoint(0x200b) + "bbb" + String.fromCodePoint(0x00a0) + "ccc";
  const report = analyze(text, rulepack);
  assert.equal(report.findings.length, 2);
  const { clean } = sanitize(text, report);
  assert.equal(clean, "aaabbbccc");
});

test("removed[] reconstructs the original text when spliced back in, in order", () => {
  const text = "aaa" + String.fromCodePoint(0x200b) + "bbb" + String.fromCodePoint(0x00a0) + "ccc";
  const report = analyze(text, rulepack);
  const { removed } = sanitize(text, report);
  // Reconstruct by walking `removed` in forward order (the function contract
  // promises removed[] is returned in forward reading order) and re-inserting
  // each original substring at the offsets it names within the ORIGINAL string.
  let rebuilt = "";
  let lastEnd = 0;
  for (const r of removed) {
    rebuilt += text.slice(lastEnd, r.start);
    rebuilt += r.original;
    lastEnd = r.end;
  }
  rebuilt += text.slice(lastEnd);
  assert.equal(rebuilt, text);
});

test("removed[] is empty when nothing was flagged", () => {
  const text = "nothing hidden here";
  const report = analyze(text, rulepack);
  const { removed } = sanitize(text, report);
  assert.deepEqual(removed, []);
});

test("sanitize handles a mixed multi-class payload in one pass", () => {
  const cyrillicA = String.fromCodePoint(0x0430);
  const text =
    "start" + String.fromCodePoint(0x200b) + " " + tagEncode("hi") + " p" + cyrillicA + "ypal end";
  const report = analyze(text, rulepack);
  const { clean } = sanitize(text, report);
  assert.equal(clean, "start  paypal end");
});

test("re-analyzing sanitized output finds zero findings", () => {
  const text = "safe" + tagEncode("secret") + String.fromCodePoint(0x200b) + "end";
  const report = analyze(text, rulepack);
  const { clean } = sanitize(text, report);
  const reReport = analyze(clean, rulepack);
  assert.deepEqual(reReport.findings, []);
});

test("sanitize removes an adjacent multi-codepoint run as one unit, not partially", () => {
  const run = String.fromCodePoint(0x200b) + String.fromCodePoint(0x200c) + String.fromCodePoint(0x200d);
  const text = "a" + run + "b";
  const report = analyze(text, rulepack);
  assert.equal(report.findings.length, 1);
  const { clean } = sanitize(text, report);
  assert.equal(clean, "ab");
});
