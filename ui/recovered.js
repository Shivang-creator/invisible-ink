// ui/recovered.js — the recovered-instruction box, right half of the band.
// Picks the finding with the longest decoded payload; every other branch is a
// verbatim state from DESIGN.md §6, never paraphrased. No detection logic:
// the "which finding decodes" choice is a presentation pick over
// Report.findings, not a new judgement about the text.

import { el, clear, chip, formatCount } from "./dom.js";

/**
 * @param {HTMLElement} container
 * @param {{
 *   mode: string,
 *   report: object|null,
 *   rulepackRuleCount: number,
 *   rulepackVersion: string,
 *   error: Error|null,
 *   tooLongLength: number,
 *   onLoadSample: (key:string)=>void,
 * }} data
 */
export function renderRecovered(container, data) {
  clear(container);
  const { mode } = data;

  if (mode === "empty") return renderPrimer(container, data);
  if (mode === "too-long") return renderTooLong(container, data);
  if (mode === "error") return renderError(container, data);
  if (mode === "known-miss") return renderKnownMissBox(container, data);

  const { report } = data;
  if (!report) return;

  const decodedFindings = report.findings.filter((f) => f.decoded);
  if (decodedFindings.length > 0) {
    const best = decodedFindings.reduce((a, b) => (b.decoded.length > a.decoded.length ? b : a));
    container.appendChild(
      el("div", { class: "recovered-title danger" }, [
        el("span", {}, "Hidden instruction recovered"),
        chip("observed"),
      ])
    );
    container.appendChild(el("blockquote", { class: "recovered-box", title: best.decoded }, `“${best.decoded}”`));
    container.appendChild(
      el(
        "div",
        { class: "recovered-meta" },
        `${best.ruleId}   offsets [${best.start}, ${best.end})   ${formatCount(best.codepoints.length)} codepoints   decoded from ${classSourceName(best.class)}`
      )
    );
    return;
  }

  if (report.findings.length > 0) {
    const chips = Object.entries(report.byRule).map(([ruleId, count]) =>
      el("span", { class: "ledger-span-chip" }, `${ruleId} x${count}`)
    );
    container.appendChild(
      el("div", { class: "recovered-title warn" }, [
        el("span", {}, `No decodable payload — ${report.findings.length} finding${report.findings.length === 1 ? "" : "s"}`),
        chip("observed"),
      ])
    );
    container.appendChild(el("div", { class: "recovered-box warn recovered-chips" }, chips));
    return;
  }

  // clean — 0 findings, non-empty text
  container.appendChild(
    el("div", { class: "recovered-title ok" }, [el("span", {}, "No hidden codepoints found"), chip("observed")])
  );
  container.appendChild(
    el(
      "div",
      { class: "recovered-box ok" },
      `Checked against ${data.rulepackRuleCount} rules in rulepack v${report.rulepackVersion}. This text delivers exactly what it displays.`
    )
  );
}

function classSourceName(cls) {
  if (cls === "TAG") return "the Unicode tag block";
  if (cls === "VS") return "a variation-selector run";
  return `${cls} codepoints`;
}

function renderPrimer(container, { onLoadSample }) {
  container.appendChild(el("div", { class: "recovered-title" }, "Paste something to analyse"));
  const primer = el("div", { class: "recovered-primer" }, [
    el("p", {}, "Paste a README, a job description, a ticket, or a PR body."),
    el(
      "p",
      { style: "margin-top:6px" },
      "This page runs entirely in your browser. Nothing is uploaded; there is no network call."
    ),
  ]);
  const buttons = el("div", { class: "sample-buttons" }, [
    el("button", { type: "button", class: "sample-btn", onClick: () => onLoadSample("poisonedReadme") }, "Load poisoned README"),
    el("button", { type: "button", class: "sample-btn", onClick: () => onLoadSample("jobDescription") }, "Load job description"),
    el(
      "button",
      { type: "button", class: "sample-btn sample-btn--known-miss", onClick: () => onLoadSample("knownMiss") },
      "Load the payload we miss"
    ),
  ]);
  primer.appendChild(buttons);
  container.appendChild(primer);
}

function renderTooLong(container, { tooLongLength, onLoadSample }) {
  container.appendChild(el("div", { class: "recovered-title warn" }, "Not analysed"));
  container.appendChild(
    el(
      "div",
      { class: "recovered-box warn" },
      `That's ${formatCount(tooLongLength)} characters. This page analyses up to 200,000 at a time so your browser stays responsive.`
    )
  );
  container.appendChild(
    el(
      "button",
      { type: "button", class: "sample-btn", style: "margin-top:12px", onClick: () => onLoadSample("__truncate") },
      "Analyse the first 200,000"
    )
  );
}

function renderError(container, { error }) {
  container.appendChild(el("div", { class: "recovered-title danger" }, "Analysis failed"));
  container.appendChild(
    el("div", { class: "recovered-box" }, [
      el("div", {}, `Analysis failed: ${error && error.message ? error.message : "unknown error"}`),
      el(
        "div",
        { class: "fs-micro", style: "margin-top:6px;font-size:var(--fs-micro);color:var(--dim)" },
        error && error.stack ? String(error.stack).split("\n")[1] || "" : ""
      ),
      el(
        "div",
        { style: "margin-top:6px;font-size:var(--fs-micro);color:var(--dim)" },
        "This is a real error, not a placeholder. Nothing on this page was faked to hide it."
      ),
    ])
  );
}

function renderKnownMissBox(container, { report }) {
  container.appendChild(
    el("div", { class: "recovered-title warn" }, [el("span", {}, "0 findings — and this text is hostile"), chip("rule")])
  );
  container.appendChild(
    el(
      "div",
      { class: "recovered-box warn" },
      "This sample carries a hidden instruction encoded as plain ASCII (base64). No codepoint in it is flagged, on purpose — see the Known Miss panel below."
    )
  );
  container.appendChild(
    el("a", { href: "#knownMissPanel", class: "recovered-meta", style: "display:inline-block" }, "Jump to what this detector cannot see ↓")
  );
}
