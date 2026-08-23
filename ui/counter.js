// ui/counter.js — the discrepancy counter. Zero computation: every number is
// read straight off the Report the caller already produced.

import { el, clear, chip, formatCount } from "./dom.js";

/**
 * @param {HTMLElement} container
 * @param {{report: object|null, mode: string}} data
 *   mode: "findings" | "clean" | "known-miss" | "empty" | "too-long" | "error"
 */
export function renderCounter(container, { report, mode }) {
  clear(container);

  if (mode === "too-long") {
    container.appendChild(
      el("div", { class: "counter-row" }, [
        el("div", { class: "counter-col" }, [
          el("div", { class: "counter-label" }, "A human reads"),
          el("div", { class: "counter-num dim" }, "—"),
        ]),
        el("div", { class: "counter-arrow" }, "→"),
        el("div", { class: "counter-col" }, [
          el("div", { class: "counter-label" }, "The model receives"),
          el("div", { class: "counter-num dim" }, "—"),
        ]),
      ])
    );
    container.appendChild(el("div", { class: "counter-caption" }, "Not analysed yet."));
    return;
  }

  if (!report) {
    // empty state
    container.appendChild(
      el("div", { class: "counter-row" }, [
        el("div", { class: "counter-col" }, [
          el("div", { class: "counter-label" }, "A human reads"),
          el("div", { class: "counter-num dim" }, "0"),
        ]),
        el("div", { class: "counter-arrow" }, "→"),
        el("div", { class: "counter-col" }, [
          el("div", { class: "counter-label" }, "The model receives"),
          el("div", { class: "counter-num dim" }, "0"),
        ]),
      ])
    );
    return;
  }

  const hasFindings = report.findings.length > 0;
  const numClass = mode === "known-miss" ? "danger" : hasFindings ? "danger" : "ok";
  const hidden = report.deliveredLength - report.visibleLength;
  const ratio = report.visibleLength > 0 ? (report.deliveredLength / report.visibleLength).toFixed(1) : null;

  container.appendChild(
    el("div", { class: "counter-row" }, [
      el("div", { class: "counter-col" }, [
        el("div", { class: "counter-label" }, "A human reads"),
        el("div", { class: `counter-num ${hasFindings ? "" : "ok"}`.trim() }, formatCount(report.visibleLength)),
        el("div", { class: "counter-unit" }, "characters"),
      ]),
      el("div", { class: "counter-arrow" }, "→"),
      el("div", { class: "counter-col" }, [
        el("div", { class: "counter-label" }, "The model receives"),
        el("div", { class: `counter-num ${numClass}` }, formatCount(report.deliveredLength)),
        el("div", { class: "counter-unit" }, "code units"),
      ]),
    ])
  );

  const metaParts = [];
  if (hasFindings) {
    metaParts.push(
      el(
        "span",
        {},
        ratio ? `+${formatCount(hidden)} hidden (${ratio}x)` : `+${formatCount(hidden)} hidden`
      )
    );
  } else {
    metaParts.push(el("span", {}, "No hidden code units."));
  }
  metaParts.push(chip("observed"));
  container.appendChild(el("div", { class: "counter-meta" }, metaParts));

  container.appendChild(
    el(
      "div",
      { class: "counter-caption" },
      `UTF-16 code units — ${formatCount(report.codepointCount)} codepoints — rulepack v${report.rulepackVersion}`
    )
  );
}
