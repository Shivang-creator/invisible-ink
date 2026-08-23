// tests/purity.test.js — the boundary test. Scans source, not behavior: it
// fails the build if core/ grows a forbidden dependency, if data/ grows code,
// or if a data file stops being pure ASCII. This is what makes the kill-switch
// guarantee and the "core imports nothing" claim provable rather than asserted.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import rulepack from "../data/rulepack.v1.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CORE_DIR = join(ROOT, "core");
const DATA_DIR = join(ROOT, "data");

function jsFilesIn(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".js"))
    .map((name) => join(dir, name));
}

test("core/ contains no forbidden model/network/framework imports or globals", () => {
  const forbidden = [
    "fetch(",
    "XMLHttpRequest",
    "process.env",
    "node:http",
    "require(\"http\")",
    "openai",
    "anthropic",
  ];
  for (const path of jsFilesIn(CORE_DIR)) {
    const source = readFileSync(path, "utf8");
    for (const token of forbidden) {
      assert.ok(
        !source.includes(token),
        `core/${path.split("/").pop()} contains forbidden token "${token}"`
      );
    }
  }
});

test("no import in core/ resolves outside core/", () => {
  const importRe = /import\s+(?:[^'"]*\s+from\s+)?["']([^"']+)["']/g;
  for (const path of jsFilesIn(CORE_DIR)) {
    const source = readFileSync(path, "utf8");
    let match;
    while ((match = importRe.exec(source))) {
      const specifier = match[1];
      assert.ok(
        specifier.startsWith("./") && !specifier.includes(".."),
        `core/${path.split("/").pop()} imports "${specifier}", which resolves outside core/`
      );
    }
  }
});

// Strip double-quoted string literals before scanning for `function`/`=>`: a
// corpus fixture's *payload text* is allowed to contain the word "function"
// or an arrow glyph (it is demonstrating what a hidden instruction looks like
// in an ordinary code snippet) -- what must never appear is those tokens as
// actual JS syntax outside a string. Every data/ file in this repo is
// generated (or hand-written) with plain double-quoted strings and no
// unescaped quotes inside them, so this is a safe, dependency-free stand-in
// for a real tokenizer.
// Comments are stripped too -- prose like "a pure function over this object"
// in a header comment is not code, and must not trip this scan either.
function stripNonCode(source) {
  const stringsBlanked = source.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  return stringsBlanked.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

test("no function declarations or arrow functions in data/ outside comments and strings", () => {
  const functionKeyword = /\bfunction\b/;
  const arrowFunction = /=>/;
  for (const path of jsFilesIn(DATA_DIR)) {
    const source = stripNonCode(readFileSync(path, "utf8"));
    const name = path.split("/").pop();
    assert.ok(!functionKeyword.test(source), `data/${name} contains a function declaration`);
    assert.ok(!arrowFunction.test(source), `data/${name} contains an arrow function`);
  }
});

test("every rule in the rulepack carries a non-empty Unicode citation", () => {
  assert.ok(rulepack.rules.length > 0);
  for (const rule of rulepack.rules) {
    assert.ok(
      typeof rule.citation === "string" && rule.citation.trim().length > 0,
      `rule ${rule.id} has no citation`
    );
  }
});

test("data/rulepack.v1.js and data/corpus.js are pure ASCII source", () => {
  for (const name of ["rulepack.v1.js", "corpus.js"]) {
    const bytes = readFileSync(join(DATA_DIR, name));
    let maxByte = 0;
    for (const b of bytes) if (b > maxByte) maxByte = b;
    assert.ok(maxByte <= 127, `data/${name} contains a byte > 127 (max seen: ${maxByte})`);
  }
});

test("test_corpus_regenerates_byte_identically_from_its_seed", () => {
  const corpusPath = join(DATA_DIR, "corpus.js");
  const before = readFileSync(corpusPath);
  execFileSync(process.execPath, [join(ROOT, "tools", "gen-corpus.mjs"), "--seed", "20260824"], {
    cwd: ROOT,
  });
  const after = readFileSync(corpusPath);
  assert.ok(before.equals(after), "regenerating data/corpus.js from the same seed changed its bytes");
});
