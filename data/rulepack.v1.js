// data/rulepack.v1.js -- versioned data, not code. The engine (core/detect.js) is a
// pure function over this object; it makes no decision this file does not encode.
// Every rule carries a `citation` into the Unicode standard so no Ledger row is an
// opinion. ASCII-only source: every non-ASCII character referenced below is named
// by its numeric codepoint (a plain ASCII integer literal), never typed literally,
// so this file survives being opened in any editor/terminal/diff viewer untouched.
//
// Six classes total (PLAN.md S1): ZW, TAG, BIDI, HG, WS shipped first (T-08);
// VS-001 (variation selectors) was added afterward, in its own isolated commit
// -- one rule object appended to `rules`, plus its own corpus fixtures (T-11's
// generator iterates rulepack.rules, so re-running `npm run corpus` picked up
// 8 new VS-001 fixtures with no generator edit), with core/detect.js untouched.
// `git show --stat` on that commit lists only `data/` files -- the abstraction
// proof PLAN.md S1 describes, exercised rather than asserted. See
// .crew/DECISIONS.md, 23:20 entry, for why this sequencing (5 classes, then a
// standalone migration commit) was chosen over T-08's literal "6 classes now"
// accept-check.

// --- HG-001 confusables table -----------------------------------------------
// Cyrillic and Greek letters that render identically or near-identically to a
// Latin ASCII letter in most fonts (Unicode Technical Standard #39, confusables
// data), plus the fullwidth Latin block (U+FF21-FF3A, U+FF41-FF5A), which is a
// fixed offset from ASCII (subtract 0xFEE0) and so needs no explicit table.
const HG_CYRILLIC_GREEK_TARGETS = {
  // Cyrillic lowercase -> ASCII lowercase
  0x0430: "a", 0x0441: "c", 0x0435: "e", 0x043e: "o", 0x0440: "p",
  0x0445: "x", 0x0443: "y", 0x0456: "i", 0x0455: "s", 0x0458: "j",
  // Cyrillic uppercase -> ASCII uppercase
  0x0410: "A", 0x0412: "B", 0x0415: "E", 0x041a: "K", 0x041c: "M",
  0x041d: "H", 0x041e: "O", 0x0420: "P", 0x0421: "C", 0x0422: "T",
  0x0425: "X", 0x0405: "S", 0x0408: "J",
  // Greek uppercase -> ASCII uppercase
  0x0391: "A", 0x0392: "B", 0x0395: "E", 0x0396: "Z", 0x0397: "H",
  0x0399: "I", 0x039a: "K", 0x039c: "M", 0x039d: "N", 0x039f: "O",
  0x03a1: "P", 0x03a4: "T", 0x03a5: "Y", 0x03a7: "X",
  // Greek lowercase -> ASCII lowercase
  0x03bf: "o", 0x03b9: "i", 0x03bd: "v",
};

const HG_CODEPOINTS = Object.keys(HG_CYRILLIC_GREEK_TARGETS).map(Number);

export default Object.freeze({
  version: "1.0.0",
  rules: [
    {
      id: "ZW-001",
      class: "ZW",
      name: "Zero-width characters",
      codepoints: [0x200b, 0x200c, 0x200d, 0xfeff],
      severity: "high",
      decode: null,
      contextExclude: "emojiZWJ",
      citation:
        "Unicode Standard sec. 23.2 'Layout Controls' and UTR #36 'Unicode Security Considerations' sec. 4; U+200B ZERO WIDTH SPACE, U+200C ZERO WIDTH NON-JOINER, U+200D ZERO WIDTH JOINER, U+FEFF ZERO WIDTH NO-BREAK SPACE (BOM)",
      description:
        "Zero-width control characters, invisible in normal rendering, that can carry a hidden payload or split tokens a filter expects to see whole.",
    },
    {
      id: "TAG-001",
      class: "TAG",
      name: "Unicode tag block",
      ranges: [[0xe0000, 0xe007f]],
      severity: "critical",
      decode: "tagblock",
      citation:
        "Unicode Standard sec. 23.9 'Tags' and UTR #36 sec. 4; U+E0000-U+E007F TAG characters mirror ASCII 0x00-0x7F one-to-one and render as nothing in virtually every font and terminal",
      description:
        "Invisible characters that mirror ASCII byte-for-byte, historically reserved for language tagging; now used to smuggle a full ASCII sentence into text a model reads but a human screen never shows.",
    },
    {
      id: "BIDI-001",
      class: "BIDI",
      name: "Bidirectional overrides and isolates",
      codepoints: [
        0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069,
      ],
      severity: "high",
      decode: null,
      citation:
        "Unicode Standard Annex #9 (UAX #9, Unicode Bidirectional Algorithm) sec. 2.2 'Explicit Formatting Characters'; U+202A-U+202E embeddings/overrides, U+2066-U+2069 isolates",
      description:
        "Explicit directional-formatting control characters that can visually reorder surrounding text without changing the underlying logical character sequence a model reads.",
    },
    {
      id: "HG-001",
      class: "HG",
      name: "Cyrillic/Greek/fullwidth homoglyphs of ASCII letters",
      codepoints: HG_CODEPOINTS,
      targets: HG_CYRILLIC_GREEK_TARGETS,
      ranges: [
        [0xff21, 0xff3a],
        [0xff41, 0xff5a],
      ],
      rangeTargetOffset: -0xfee0,
      severity: "medium",
      decode: "homoglyph",
      citation:
        "Unicode Technical Standard #39 (UTS #39, 'Unicode Security Mechanisms') sec. 4 'Confusable Detection'; Cyrillic/Greek letters and the fullwidth Latin block (U+FF21-U+FF3A, U+FF41-U+FF5A) rendering visually identical or near-identical to plain ASCII letters",
      description:
        "Cyrillic, Greek and fullwidth-Latin codepoints that look like plain ASCII letters, used to defeat literal string matching, keyword filters and brand-name checks.",
    },
    {
      id: "VS-001",
      class: "VS",
      name: "Variation selectors",
      ranges: [
        [0xfe00, 0xfe0f],
        [0xe0100, 0xe01ef],
      ],
      severity: "critical",
      decode: "variationselector",
      contextExclude: "emojiVariationSelector",
      citation:
        "Unicode Standard sec. 23.4 'Variation Selectors' and the Unicode Ideographic Variation Database (IVD); U+FE00-U+FE0F standardized variation selectors, U+E0100-U+E01EF variation selectors supplement -- a documented technique appends one selector per hidden byte after a visible base character to smuggle an invisible message",
      description:
        "Variation-selector codepoints that normally pick a glyph variant for the preceding character; a documented 'emoji smuggling' technique instead uses a run of selectors, one per hidden byte, to encode an invisible message after a visible emoji or ASCII character.",
    },
    {
      id: "WS-001",
      class: "WS",
      name: "Unusual whitespace",
      codepoints: [
        0x00a0, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006,
        0x2007, 0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x3000,
      ],
      severity: "low",
      decode: null,
      citation:
        "Unicode Standard sec. 6.2 'General Punctuation' and UTR #36 sec. 4; U+00A0 NO-BREAK SPACE, U+2000-U+200A width-variant spaces, U+2028 LINE SEPARATOR, U+2029 PARAGRAPH SEPARATOR, U+3000 IDEOGRAPHIC SPACE",
      description:
        "Whitespace codepoints outside the ordinary ASCII space/tab that still read as blank space but can defeat exact-match filters or pad a hidden payload.",
    },
  ],
});
