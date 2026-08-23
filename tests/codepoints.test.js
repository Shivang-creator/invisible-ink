import { test } from "node:test";
import assert from "node:assert/strict";
import { toRecords, deliveredLength, visibleLength } from "../core/codepoints.js";

test("toRecords splits plain ASCII one record per character", () => {
  const records = toRecords("abc");
  assert.equal(records.length, 3);
  assert.deepEqual(
    records.map((r) => r.index),
    [0, 1, 2]
  );
  assert.deepEqual(
    records.map((r) => r.utf16len),
    [1, 1, 1]
  );
});

test("toRecords returns empty array for empty string", () => {
  assert.deepEqual(toRecords(""), []);
});

test("test_astral_tag_codepoint_counts_as_one_record_with_utf16len_two", () => {
  // U+E0041 is an astral (outside-BMP) tag-block codepoint: a surrogate pair in
  // UTF-16, but exactly one Unicode codepoint. It must produce exactly one
  // record, not two.
  const text = "x" + String.fromCodePoint(0xe0041) + "y";
  const records = toRecords(text);
  assert.equal(records.length, 3);
  const [first, astral, last] = records;
  assert.equal(first.index, 0);
  assert.equal(first.utf16len, 1);
  assert.equal(astral.cp, 0xe0041);
  assert.equal(astral.index, 1);
  assert.equal(astral.utf16len, 2);
  // The record after the astral codepoint must have advanced by 2 code units,
  // not by 1 (which is what a naive charCodeAt loop would do).
  assert.equal(last.index, 3);
  assert.equal(last.utf16len, 1);
});

test("toRecords keeps astral char field as the full codepoint string", () => {
  const text = String.fromCodePoint(0x1f468); // outside BMP, non-tag, for contrast
  const [record] = toRecords(text);
  assert.equal(record.char, text);
  assert.equal(record.cp, 0x1f468);
});

test("deliveredLength counts UTF-16 code units, including astral pairs as two", () => {
  const text = "ab" + String.fromCodePoint(0xe0041);
  assert.equal(deliveredLength(text), 4); // 'a' + 'b' + surrogate pair (2 units)
});

test("visibleLength subtracts flagged records' code units", () => {
  const records = toRecords("ab" + String.fromCodePoint(0xe0041) + "c");
  const isFlagged = (r) => r.cp === 0xe0041;
  // total code units = 1+1+2+1 = 5; flagged astral record removes 2
  assert.equal(visibleLength(records, isFlagged), 3);
});

test("visibleLength with no flags equals deliveredLength", () => {
  const text = "hello world";
  const records = toRecords(text);
  assert.equal(visibleLength(records, () => false), deliveredLength(text));
});

test("visibleLength with everything flagged is zero", () => {
  const text = "hello";
  const records = toRecords(text);
  assert.equal(visibleLength(records, () => true), 0);
});
