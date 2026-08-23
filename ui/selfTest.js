// ui/selfTest.js — pure renderer for the Self-Test Strip. The corpus run
// itself (calling analyze() on every data/corpus.js case and timing it)
// happens in app.js, the orchestrator; this module only turns the result
// into DOM. Numbers are never typed here — corpusResult and testResults are
// read straight from the run and from data/test-results.js.

import { el, clear, chip, formatCount } from "./dom.js";

/**
 * @param {HTMLElement} container
 * @param {{
 *   corpusResult: {pass:number, total:number, elapsedMs:number, seed:number, failingIds:string[]},
 *   testResults: {pass:number, total:number, dependencies:number, command:string, ranAt:string},
 *   onLoadCase: (caseId:string)=>void,
 * }} data
 */
export function renderSelfTestStrip(container, { corpusResult, testResults, onLoadCase }) {
  clear(container);
  const failed = corpusResult.pass !== corpusResult.total;
  container.dataset.fail = String(failed);

  const leftHeadline = failed
    ? `${corpusResult.pass}/${corpusResult.total} — ${corpusResult.total - corpusResult.pass} corpus case${
        corpusResult.total - corpusResult.pass === 1 ? "" : "s"
      } failing`
    : `${corpusResult.pass}/${corpusResult.total} corpus cases passing`;

  const left = el("div", { class: "strip-half" }, [
    el("div", { class: "strip-headline" }, [
      el("span", { class: "num" }, leftHeadline),
      !failed ? ` · verified in this browser, ${Math.round(corpusResult.elapsedMs)} ms` : "",
    ]),
    el("div", { class: "strip-caption" }, [
      el("span", {}, `${corpusResult.total} cases, seed ${corpusResult.seed}`),
      chip("observed"),
    ]),
  ]);

  if (failed) {
    const fails = el(
      "div",
      { class: "strip-fail-list" },
      corpusResult.failingIds.map((id) =>
        el("button", { type: "button", class: "strip-fail-btn", onClick: () => onLoadCase(id) }, id)
      )
    );
    left.appendChild(fails);
  }

  const right = el("div", { class: "strip-half" }, [
    el("div", { class: "strip-headline" }, [
      el("span", { class: "num" }, `${testResults.pass}/${testResults.total} in node --test`),
      ` · ${formatCount(testResults.dependencies)} dependencies`,
    ]),
    el("div", { class: "strip-caption" }, [
      el("span", { class: "strip-code", title: `ranAt: ${testResults.ranAt}` }, testResults.command || "npm test"),
      chip("cached"),
    ]),
  ]);

  container.appendChild(left);
  container.appendChild(right);
}
