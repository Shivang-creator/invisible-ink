// ui/ledger.js — one row per finding, the evidence table. Every value comes
// straight off report.findings; the only synthesis here is string formatting
// (a "text.slice(a, b)" repro expression, a citation clamp) — never a new
// offset, a new class or a new verdict. One delegated click/keydown listener
// on the <ol> (attached once, in initLedger) drives row activation, the copy
// button and the per-rule expander, instead of one listener per row.

import { el, clear, chip, formatCount } from "./dom.js";

const SEVERITY_WORDS = { critical: "critical", high: "high", medium: "medium", low: "low" };

/**
 * Build the panel chrome once and wire the single delegated listener.
 * @param {HTMLElement} container
 * @param {{onActivate:(idx:number)=>void, onCopy:(text:string, btn:HTMLElement)=>void}} handlers
 * @returns {{list: HTMLElement, body: HTMLElement}}
 */
export function initLedger(container, { onActivate, onCopy }) {
  clear(container);
  const list = el("ol", { class: "ledger-list" });
  const body = el("div", {}, [list]);

  container.appendChild(
    el("div", { class: "ledger-panel-header" }, [
      el("span", { class: "ledger-title" }, "The Ledger"),
      el("span", { class: "ledger-span-note" }, "spans are half-open [start, end)"),
    ])
  );
  container.appendChild(body);

  list.addEventListener("click", (event) => {
    const copyBtn = event.target.closest(".ledger-copy-btn");
    if (copyBtn) {
      event.stopPropagation();
      onCopy(copyBtn.dataset.copyText, copyBtn);
      return;
    }
    const expandBtn = event.target.closest(".ledger-expand-btn");
    if (expandBtn) {
      event.stopPropagation();
      const row = expandBtn.closest(".ledger-row");
      const bodyEl = row.querySelector(".ledger-expand-body");
      const open = bodyEl.hidden;
      bodyEl.hidden = !open;
      expandBtn.setAttribute("aria-expanded", String(open));
      expandBtn.textContent = (open ? "v " : "> ") + "why a model still reads this";
      return;
    }
    const row = event.target.closest(".ledger-row");
    if (row) onActivate(Number(row.dataset.idx));
  });

  list.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const row = event.target.closest(".ledger-row");
    if (!row || event.target !== row) return;
    event.preventDefault();
    onActivate(Number(row.dataset.idx));
  });

  return { list, body };
}

/**
 * @param {HTMLElement} list  the <ol> returned by initLedger
 * @param {{report: object, mode: string, explanations: object, activeIndex: number}} data
 */
export function renderLedger(list, { report, mode, explanations, activeIndex }) {
  clear(list);

  if (mode === "empty") {
    list.appendChild(el("p", { class: "ledger-empty" }, "Nothing to show yet."));
    return;
  }
  if (mode === "too-long") {
    list.appendChild(el("p", { class: "ledger-empty" }, "Not analysed — text exceeds the 200,000-character ceiling."));
    return;
  }
  if (!report || report.findings.length === 0) {
    const msg =
      mode === "known-miss"
        ? "0 findings — by construction. See the Known Miss panel below."
        : "0 findings. This text delivers exactly what it displays.";
    list.appendChild(el("p", { class: "ledger-empty" }, msg));
    return;
  }

  report.findings.forEach((finding, idx) => {
    list.appendChild(renderRow(finding, idx, { explanations, active: idx === activeIndex }));
  });
}

function renderRow(finding, idx, { explanations, active }) {
  const severityWord = SEVERITY_WORDS[finding.severity] || finding.severity;
  const sliceExpr = `text.slice(${finding.start}, ${finding.end})`;
  const explanation = explanations && explanations[finding.ruleId];

  const row = el(
    "li",
    {
      class: `ledger-row${active ? " ledger-row--active" : ""}`,
      tabindex: "0",
      dataset: { idx: String(idx) },
      "aria-label": `${finding.ruleId}, ${finding.class} class, ${severityWord} severity, offsets ${finding.start} to ${finding.end}. Activate to locate in the codepoint view.`,
    },
    []
  );

  row.appendChild(
    el("div", { class: "ledger-row-top" }, [
      el("span", { class: "chip severity-chip", dataset: { severity: finding.severity } }, severityWord),
      el("span", { class: "ledger-rule-id" }, finding.ruleId),
      el("span", { class: "ledger-rule-name" }, finding.name || ruleClassName(finding.class)),
    ])
  );

  row.appendChild(
    el("div", { class: "ledger-span-line" }, [
      el("span", { class: "ledger-span-chip" }, `[${finding.start}, ${finding.end})`),
      el("span", {}, "UTF-16 code units"),
      el("span", {}, `${formatCount(finding.codepoints.length)} codepoint${finding.codepoints.length === 1 ? "" : "s"}`),
      chip("observed"),
    ])
  );

  if (finding.decoded) {
    row.appendChild(el("div", { class: "ledger-decoded" }, `“${finding.decoded}”`));
  }

  row.appendChild(
    el("div", { class: "ledger-slice-row" }, [
      el("code", { class: "ledger-slice-code" }, sliceExpr),
      el(
        "button",
        { type: "button", class: "ledger-copy-btn", dataset: { copyText: sliceExpr } },
        "copy"
      ),
    ])
  );

  row.appendChild(
    el("div", { class: "ledger-citation-row" }, [
      el("span", { class: "ledger-citation", title: finding.citation }, finding.citation),
      chip("rule"),
    ])
  );

  // Both variants are always in the DOM; [data-model="off"] on <html> switches
  // which one is visible in pure CSS. That is the whole toggle mechanism —
  // no JS re-render follows from flipping the model layer, by construction.
  // `explanation` comes from data/explanations.js, which is real,
  // human-written, deterministic prose derived from finding.citation above —
  // never model output — so it is tagged RULE here, the same tag the
  // citation itself carries, not GENERATED.
  const expandBody = el("div", { class: "ledger-expand-body", hidden: true }, [
    el("div", { class: "model-on-note" }, explanation || "No explanation on file for this rule yet."),
    el("div", { class: "model-off-note" }, "Explanation layer off. No number in this row changed."),
  ]);
  row.appendChild(
    el("div", { class: "ledger-expander" }, [
      el("div", { class: "ledger-row-top" }, [
        el(
          "button",
          { type: "button", class: "ledger-expand-btn", "aria-expanded": "false" },
          "> why a model still reads this"
        ),
        chip("rule"),
      ]),
      expandBody,
    ])
  );

  return row;
}

function ruleClassName(cls) {
  const names = {
    ZW: "Zero-width characters",
    TAG: "Unicode tag block",
    BIDI: "Bidirectional overrides and isolates",
    HG: "Homoglyphs of ASCII letters",
    VS: "Variation selectors",
    WS: "Unusual whitespace",
  };
  return names[cls] || cls;
}
