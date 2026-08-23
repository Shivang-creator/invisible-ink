// ui/revealPane.js — the two synchronized panes. Left ("what a human sees")
// is the live textarea itself, built once at init and never rebuilt, so
// typing never loses cursor position. Right ("what the model receives") is
// one cell per codepoint, rebuilt from the Report on every analysis.
//
// Zero computation: cell flagging is a range join against report.findings
// (is this record's offset inside some finding's [start,end)?), never a
// codepoint-value test. Formatting only calls Number#toString for hex —
// no manual bit arithmetic on a codepoint anywhere in this file.
//
// Performance technique named per the training doc: focus windows. A finding
// span (capped) plus +/-24 codepoints of context is rendered; everything
// else collapses into an elision row carrying the true skipped count and the
// offset rendering resumes at. Without that, a hostile 200,000-character
// paste would put ~200,000 DOM nodes in one tab. One delegated click
// listener on the pane (attached once at init) replaces a listener per cell.

import { el, clear, hex, formatCount } from "./dom.js";

const MAX_TOTAL_CELLS = 1500;
const MAX_FINDING_CELLS = 400;
const CONTEXT_CODEPOINTS = 24;
const ROW_WIDTH = 16;
const MAX_FOCUSABLE_FLAGGED = 300;

/**
 * Build the pane chrome once. Returns the live textarea (the human pane) and
 * the model-pane container that renderModelPane rebuilds on every analysis.
 * @param {HTMLElement} container
 * @param {{onActivateOffset: (offset:number)=>void}} handlers
 * @returns {{textarea: HTMLTextAreaElement, modelPane: HTMLElement}}
 */
export function initRevealPane(container, { onActivateOffset }) {
  clear(container);

  const textarea = el("textarea", {
    id: "inputText",
    class: "human-pane",
    spellcheck: "false",
    autocomplete: "off",
    autocapitalize: "off",
    "aria-label": "Paste text to analyse — what a human sees",
  });

  const humanHalf = el("div", { class: "reveal-half reveal-half--human" }, [
    el("div", { class: "reveal-half-header" }, [
      el("span", { class: "reveal-half-title" }, "What a human sees"),
      el(
        "span",
        { class: "reveal-half-caption" },
        "editable — what your browser renders here is exactly what a human sees"
      ),
    ]),
    textarea,
  ]);

  const modelPane = el("div", {
    class: "model-pane",
    role: "group",
    "aria-label": "Codepoint view. The authoritative finding list is the Ledger.",
  });
  modelPane.addEventListener("click", (event) => {
    const cell = event.target.closest("[data-offset]");
    if (!cell) return;
    onActivateOffset(Number(cell.dataset.offset));
  });

  const modelHalf = el("div", { class: "reveal-half reveal-half--model" }, [
    el("div", { class: "reveal-half-header" }, [
      el("span", { class: "reveal-half-title" }, "What the model receives"),
      el(
        "span",
        { class: "reveal-half-caption" },
        "one cell per codepoint — hidden codepoints shown as hex, U+ prefix omitted in cells"
      ),
    ]),
    modelPane,
    el("p", { class: "reveal-footnote" }, "offsets are UTF-16 code units, the same unit String.slice uses"),
  ]);

  container.appendChild(humanHalf);
  container.appendChild(modelHalf);

  return { textarea, modelPane };
}

function lowerBound(records, target) {
  let lo = 0;
  let hi = records.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (records[mid].index < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function sumUtf16(records, from, to) {
  let sum = 0;
  for (let i = from; i < to; i++) sum += records[i].utf16len;
  return sum;
}

function computeWindows(records, findings) {
  if (records.length === 0) return [];
  if (findings.length === 0) {
    return [{ start: 0, end: Math.min(MAX_TOTAL_CELLS, records.length) }];
  }
  const raw = [];
  for (const f of findings) {
    let start = lowerBound(records, f.start);
    let end = lowerBound(records, f.end);
    if (end - start > MAX_FINDING_CELLS) end = start + MAX_FINDING_CELLS;
    start = Math.max(0, start - CONTEXT_CODEPOINTS);
    end = Math.min(records.length, end + CONTEXT_CODEPOINTS);
    raw.push({ start, end });
  }
  raw.sort((a, b) => a.start - b.start);
  const merged = [];
  for (const w of raw) {
    const last = merged[merged.length - 1];
    if (last && w.start <= last.end) last.end = Math.max(last.end, w.end);
    else merged.push({ start: w.start, end: w.end });
  }
  const capped = [];
  let total = 0;
  for (const w of merged) {
    const size = w.end - w.start;
    if (total + size > MAX_TOTAL_CELLS) {
      const remaining = MAX_TOTAL_CELLS - total;
      if (remaining > 0) capped.push({ start: w.start, end: w.start + remaining });
      break;
    }
    capped.push(w);
    total += size;
  }
  return capped;
}

/**
 * Rebuild the model-side cell grid. `mode` mirrors the app state machine:
 * "empty" and "too-long" show a placeholder line instead of a grid; the
 * caller must not invoke this at all in "error" mode (the pane stays
 * frozen at its last good render, per the state matrix).
 * @param {HTMLElement} modelPane
 * @param {{records: object[], report: object, mode: string, activeIndex: number}} data
 */
export function renderModelPane(modelPane, { records, report, mode, activeIndex }) {
  clear(modelPane);

  if (mode === "empty") {
    modelPane.appendChild(
      el("p", { class: "reveal-footnote" }, "paste text and it appears here, one cell per codepoint")
    );
    return;
  }
  if (mode === "too-long") {
    modelPane.appendChild(
      el("p", { class: "reveal-footnote" }, "Not rendered — text exceeds the 200,000-character analysis ceiling.")
    );
    return;
  }

  const findings = report.findings;
  const windows = computeWindows(records, findings);
  const totalFlagged = findings.reduce((sum, f) => sum + f.codepoints.length, 0);

  const grid = el("div", { class: "cells" });
  let fi = 0;
  let prevFinding = null;
  let prevFlagCell = null;
  let lastEnd = 0;

  for (const w of windows) {
    if (w.start > lastEnd) {
      const skippedCodepoints = w.start - lastEnd;
      const skippedUnits = sumUtf16(records, lastEnd, w.start);
      const resumeAt = records[w.start] ? records[w.start].index : report.deliveredLength;
      grid.appendChild(
        el(
          "div",
          { class: "elision-row" },
          `… ${formatCount(skippedCodepoints)} codepoints (${formatCount(skippedUnits)} code units) with no findings, resuming at offset ${resumeAt} …`
        )
      );
    }

    let col = 0;
    let rowStartOffset = records[w.start] ? records[w.start].index : 0;
    let rowCells = [];

    const flushRow = () => {
      grid.appendChild(el("div", { class: "gutter" }, String(rowStartOffset).padStart(5, "0")));
      for (const c of rowCells) grid.appendChild(c);
      for (let pad = rowCells.length; pad < ROW_WIDTH; pad++) {
        grid.appendChild(el("div", { class: "cell cell--empty" }));
      }
      rowCells = [];
      col = 0;
    };

    for (let i = w.start; i < w.end; i++) {
      const record = records[i];
      if (col === 0) rowStartOffset = record.index;

      while (fi < findings.length && findings[fi].end <= record.index) fi++;
      const current =
        fi < findings.length && findings[fi].start <= record.index && record.index < findings[fi].end
          ? findings[fi]
          : null;

      let cellEl;
      if (current) {
        const isRunStart = current !== prevFinding;
        const focusable = totalFlagged <= MAX_FOCUSABLE_FLAGGED || isRunStart;
        const label = `U+${hex(record.cp)} at offset ${record.index}, ${current.ruleId}`;
        cellEl = el(
          focusable ? "button" : "span",
          {
            class: `cell cell--flag${activeIndex === fi ? " cell--active" : ""}`,
            dataset: { severity: current.severity, offset: String(record.index) },
            type: focusable ? "button" : undefined,
            title: label,
            "aria-label": label,
          },
          hex(record.cp)
        );
      } else {
        const isNL = record.char === "\n";
        cellEl = el(
          "span",
          { class: `cell cell--plain${isNL ? " cell--nl" : ""}`, "aria-hidden": "true" },
          isNL ? "¬" : record.char
        );
      }

      if (current !== prevFinding) {
        if (prevFlagCell) prevFlagCell.dataset.runEnd = "true";
        if (current) cellEl.dataset.runStart = "true";
      }
      prevFinding = current;
      prevFlagCell = current ? cellEl : null;

      rowCells.push(cellEl);
      col++;
      const isNewline = record.char === "\n";
      if (col === ROW_WIDTH || isNewline || i === w.end - 1) flushRow();
    }
    lastEnd = w.end;
  }
  if (prevFlagCell) prevFlagCell.dataset.runEnd = "true";

  if (lastEnd < records.length) {
    const skippedUnits = sumUtf16(records, lastEnd, records.length);
    grid.appendChild(
      el(
        "div",
        { class: "elision-row" },
        `… ${formatCount(records.length - lastEnd)} codepoints (${formatCount(skippedUnits)} code units) with no findings …`
      )
    );
  }

  modelPane.appendChild(grid);
}
