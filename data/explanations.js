// data/explanations.js -- real, deterministic explanatory prose, one entry
// per rule class in data/rulepack.v1.js. NOT written by a model: no call to
// any model was made in this build. Every provider available tonight was
// unreachable or saturated through the submission window (see
// .crew/DECISIONS.md, R-01, for which ones and why), so
// tools/gen-explanations.mjs never ran. Rather than fake a model's voice or
// leave
// the page attributing authorship to a model that wrote nothing, this file
// carries real prose written by a human, each sentence derived from the same
// Unicode citation already carried on the matching rule object in
// data/rulepack.v1.js. That makes its epistemic tag RULE -- the same
// category as the citations themselves -- never GENERATED. ui/legend.js and
// ui/ledger.js tag it accordingly; no chip on this page claims a model wrote
// anything.
//
// core/detect.js and core/sanitize.js never import this file (see PLAN.md
// S2) -- its presence, absence or content cannot move a single number the
// Ledger prints. That is the kill-switch guarantee (tools/killswitch.mjs,
// tests/killswitch.test.js), independent of what this file contains.
//
// If a model is ever actually called to regenerate `byRule`, the fields
// below (`source`, `generatedAt`, `promptHash`) are exactly what would need
// to flip to reflect that -- and the RULE chip would need to become
// GENERATED at the same time, not before.

export default Object.freeze({
  source: "rulepack.v1 citations (human-written, deterministic, not model output)",
  generatedAt: null,
  promptHash: null,
  byRule: Object.freeze({
    "ZW-001":
      "Zero-width characters (U+200B, U+200C, U+200D, U+FEFF) render as nothing in virtually every font, so a human reading this text sees no gap and no mark. A language model's tokenizer still receives each one as an ordinary input codepoint -- Unicode Standard sec. 23.2 'Layout Controls' and UTR #36 sec. 4 document them as invisible formatting controls, not as characters a renderer is required to strip before a model sees them. A payload hidden between two zero-width characters is invisible on screen and fully present in the token stream a model reads.",
    "TAG-001":
      "The Unicode tag block (U+E0000-U+E007F, sec. 23.9 'Tags') mirrors ASCII 0x00-0x7F one-to-one and was designed to render as nothing in virtually every font and terminal (UTR #36 sec. 4). A model that decodes tag codepoints back to their ASCII originals recovers a full hidden sentence a human screen never displayed at all -- this is the exact mechanism behind this page's 134-visible-character / 310-code-unit-delivered gap.",
    "BIDI-001":
      "Explicit bidirectional formatting characters (U+202A-U+202E embeddings/overrides, U+2066-U+2069 isolates; UAX #9 sec. 2.2) can visually reorder the characters around them without changing the underlying logical sequence a model reads. Text that reads as one instruction on screen can be a different instruction in the order a model actually processes -- the display and the data can disagree.",
    "HG-001":
      "Cyrillic, Greek and fullwidth-Latin codepoints in this table (UTS #39 sec. 4 'Confusable Detection') render visually identical or near-identical to plain ASCII letters in most fonts. Substituting a look-alike for a Latin letter can defeat an exact-string or keyword filter while still reading as ordinary text to a human eye. The same mechanism also fires on entirely legitimate Cyrillic or Greek prose, which is not hidden from this page -- see the Known Miss panel's disclosure of that false-positive direction.",
    "VS-001":
      "Variation selectors (U+FE00-U+FE0F and the supplement U+E0100-U+E01EF, sec. 23.4 and the Unicode Ideographic Variation Database) normally just pick a glyph variant for the character immediately before them. A documented 'emoji smuggling' technique instead appends a run of selectors, one per hidden byte, after a visible emoji or ASCII character -- encoding a message a human never sees and a model can decode selector by selector.",
    "WS-001":
      "Codepoints such as U+00A0 NO-BREAK SPACE and the U+2000-U+200A width-variant spaces (sec. 6.2 'General Punctuation', UTR #36 sec. 4) read as ordinary blank space to a human but are distinct characters to an exact-match string comparison and to a model's tokenizer. They can pad a hidden payload or quietly defeat a filter that only expects an ASCII 0x20 space.",
  }),
});
