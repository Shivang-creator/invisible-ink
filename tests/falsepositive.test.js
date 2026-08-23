import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../core/detect.js";
import rulepack from "../data/rulepack.v1.js";

test("test_family_emoji_zwj_not_flagged", () => {
  // U+200D ZWJ joining man+ZWJ+woman+ZWJ+girl into the family emoji is a
  // legitimate ZWJ sequence, not a hidden zero-width payload.
  const family =
    String.fromCodePoint(0x1f468) +
    String.fromCodePoint(0x200d) +
    String.fromCodePoint(0x1f469) +
    String.fromCodePoint(0x200d) +
    String.fromCodePoint(0x1f467);
  const r = analyze(family, rulepack);
  assert.deepEqual(r.findings, []);
});

test("test_legitimate_rtl_paragraph_not_flagged", () => {
  // Ordinary Hebrew script letters are not bidi *control* characters (they are
  // not in the BIDI-001 codepoint set at all), so a natural RTL paragraph with
  // no explicit override/isolate codepoints must produce zero findings.
  const hebrew =
    String.fromCodePoint(0x05e9, 0x05dc, 0x05d5, 0x05dd) +
    ", " +
    String.fromCodePoint(0x05de, 0x05d4) +
    " " +
    String.fromCodePoint(0x05e9, 0x05dc, 0x05d5, 0x05de, 0x05da) +
    "?";
  const r = analyze(hebrew, rulepack);
  assert.deepEqual(r.findings, []);
});

test("legitimate Arabic RTL paragraph is not flagged", () => {
  const arabic = String.fromCodePoint(
    0x0627, 0x0644, 0x0633, 0x0644, 0x0627, 0x0645, 0x0020, 0x0639, 0x0644, 0x064a, 0x0643, 0x0645
  );
  const r = analyze(arabic, rulepack);
  assert.deepEqual(r.findings, []);
});

test("German soft hyphen (U+00AD) inside a hyphenated word is not flagged", () => {
  const text = "Silben" + String.fromCodePoint(0x00ad) + "trennung ist normal.";
  const r = analyze(text, rulepack);
  assert.deepEqual(r.findings, []);
});

test("a combining acute accent is not flagged", () => {
  const text = "cafe" + String.fromCodePoint(0x0301); // combining acute, U+0301
  const r = analyze(text, rulepack);
  assert.deepEqual(r.findings, []);
});

test("an emoji followed by its legitimate presentation variation selector (U+FE0F) is not flagged", () => {
  // Regardless of whether VS-001 has landed yet in this rulepack version, an
  // emoji immediately followed by U+FE0F must never be flagged: it is the
  // standard "render as emoji" selector, excluded by the emojiVariationSelector
  // context rule the moment VS-001 exists.
  const text = "shipped a fix " + String.fromCodePoint(0x2705, 0xfe0f) + " today";
  const r = analyze(text, rulepack);
  assert.deepEqual(r.findings, []);
});

test("plain ASCII README produces zero findings", () => {
  const readme = "# Project\n\nInstall with npm install, then run npm test.\n";
  const r = analyze(readme, rulepack);
  assert.deepEqual(r.findings, []);
});

test("an ordinary ASCII tab character is not flagged as unusual whitespace", () => {
  const text = "function f() {\n\treturn 1;\n}";
  const r = analyze(text, rulepack);
  assert.deepEqual(r.findings, []);
});

test("a URL with percent-encoded %20 is not flagged", () => {
  const text = "See https://example.com/a%20b?q=c%20d for details.";
  const r = analyze(text, rulepack);
  assert.deepEqual(r.findings, []);
});

test("ordinary ASCII straight quotes and apostrophes are not flagged", () => {
  const text = "It's a \"normal\" sentence with punctuation.";
  const r = analyze(text, rulepack);
  assert.deepEqual(r.findings, []);
});

// R-10 (2026-08-24, pc-red-team): everything above pins text that SHOULD
// produce zero findings. This detector also over-fires on entirely
// legitimate non-Latin prose, and until now nothing in this suite covered
// that direction at all -- Hebrew and Arabic were the only non-Latin scripts
// tested, and both happen to have no letters in HG-001's confusables table.
// These four cases pin the actual (non-zero) counts the false-positive
// disclosure in data/known-miss.js's `overReporting` describes, so the
// disclosure stays true if the rulepack ever changes. Every one of these
// findings is individually correct -- the flagged character really is a
// homoglyph or a zero-width joiner, citation and all -- the trade-off is
// firing on ordinary prose, not a wrong verdict on any single character.

test("test_ordinary_russian_sentence_produces_known_homoglyph_false_positives", () => {
  // "Privet, kak dela? Eto obychnoye soobshcheniye." (an ordinary greeting)
  // -- 11 of its Cyrillic letters are in HG-001's confusables table.
  const russian = String.fromCodePoint(
    0x41f, 0x440, 0x438, 0x432, 0x435, 0x442, 0x2c, 0x20, 0x43a, 0x430, 0x43a, 0x20, 0x434, 0x435,
    0x43b, 0x430, 0x3f, 0x20, 0x42d, 0x442, 0x43e, 0x20, 0x43e, 0x431, 0x44b, 0x447, 0x43d, 0x43e,
    0x435, 0x20, 0x441, 0x43e, 0x43e, 0x431, 0x449, 0x435, 0x43d, 0x438, 0x435, 0x2e
  );
  const r = analyze(russian, rulepack);
  assert.equal(r.findings.length, 11);
  assert.ok(r.findings.every((f) => f.ruleId === "HG-001"));
});

test("test_ordinary_greek_sentence_produces_known_homoglyph_false_positives", () => {
  // "Kalimera, pos eisai simera?" (an ordinary greeting) -- 2 of its Greek
  // letters are in HG-001's confusables table.
  const greek = String.fromCodePoint(
    0x39a, 0x3b1, 0x3bb, 0x3b7, 0x3bc, 0x3ad, 0x3c1, 0x3b1, 0x2c, 0x20, 0x3c0, 0x3ce, 0x3c2, 0x20,
    0x3b5, 0x3af, 0x3c3, 0x3b1, 0x3b9, 0x20, 0x3c3, 0x3ae, 0x3bc, 0x3b5, 0x3c1, 0x3b1, 0x3b
  );
  const r = analyze(greek, rulepack);
  assert.equal(r.findings.length, 2);
  assert.ok(r.findings.every((f) => f.ruleId === "HG-001"));
});

test("test_legitimate_devanagari_zwj_conjunct_produces_known_zero_width_false_positive", () => {
  // U+0915 KA + U+094D VIRAMA + U+200D ZWJ + U+0937 SSA is the standard,
  // correct way to force an explicit half-form conjunct in Devanagari
  // typography -- not a hidden payload. ZW-001's emojiZWJ context exclusion
  // only applies between two emoji-like codepoints, so this legitimate use
  // of ZWJ is still flagged.
  const devanagariConjunct = String.fromCodePoint(0x915, 0x94d, 0x200d, 0x937);
  const r = analyze(devanagariConjunct, rulepack);
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].ruleId, "ZW-001");
});

test("test_typographic_nbsp_produces_known_whitespace_false_positive", () => {
  // A non-breaking space used exactly as intended -- keeping "10 kg"
  // together -- is still a WS-001 finding.
  const text = "The package weighs 10" + String.fromCodePoint(0xa0) + "kg in total.";
  const r = analyze(text, rulepack);
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].ruleId, "WS-001");
});
