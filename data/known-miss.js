// data/known-miss.js — the Known Miss, as a first-class, documented, TESTED
// property of this detector, not a disclaimer bolted onto a demo. This engine
// reads codepoints; it does not decode semantics. A payload that is itself
// plain ASCII, but decodes (via base64, rot13, or any other semantic transform
// a downstream model is happy to reverse) into an instruction, contains no
// flagged codepoint at all — so it is structurally, not accidentally, outside
// what a codepoint-level rulepack can ever see. The same is true of anything
// that depends on rendering rather than characters: an HTML comment, or text
// made invisible by CSS (white text on a white background) reads, as plain
// text, as ordinary visible characters — this tool reads plain text, it does
// not render a page, so it has no way to know how a browser would paint it.
//
// See data/samples.js's `knownMiss` for the pasteable instance, and
// tests/knownmiss.test.js's `test_known_miss_base64_remains_undetected` for
// the assertion that keeps this honest: if this ever starts finding something
// there, the test fails loudly, on purpose.
//
// R-10 (2026-08-24, pc-red-team): the panel above disclosed only the
// direction where this detector misses (false negatives). It said nothing
// about the opposite direction, where it over-fires on entirely legitimate
// text (false positives) -- a real, reproducible gap: an ordinary Cyrillic
// or Greek sentence trips HG-001 on every confusable letter, and a
// legitimate Devanagari conjunct trips ZW-001 on its ZWJ. Every one of those
// rows is technically correct (that character genuinely is a homoglyph or a
// zero-width joiner, citation and all) and still a precision problem this
// build has not solved. `overReporting` below states that plainly, and
// tests/falsepositive.test.js pins the exact counts so the disclosure stays
// true if the rulepack ever changes.

export default Object.freeze({
  title: "What this detector cannot see",
  summary:
    "This detector inspects codepoints, not meaning and not rendering. A hidden instruction that is itself plain ASCII — base64, rot13, or any other semantic encoding a model can decode but no codepoint rule flags — produces zero findings by construction, and so does anything that depends on how a browser renders the text (an HTML comment, white-on-white CSS) rather than on which characters are present.",
  outOfScope: [
    "Semantic obfuscation of plain ASCII text (base64, rot13, hex, and similar reversible encodings a model is willing to decode).",
    "Rendering-layer tricks that require a browser to interpret markup or styling (HTML comments, CSS visibility/color tricks, off-screen positioning).",
  ],
  overReporting:
    "It also over-reports in the other direction: HG-001 flags Cyrillic and Greek letters that are genuine homoglyphs of ASCII, so an ordinary Russian sentence produces six medium-severity rows. Every one of those rows is technically correct and useless. Homoglyph detection on non-Latin script is a precision trade-off we have not solved — we print it rather than hide it.",
});
