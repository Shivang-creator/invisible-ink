// ui/knownMiss.js — renders data/known-miss.js verbatim. No copy is retyped
// here; this module only decides visibility (shown once the known-miss
// sample is the active text) and lays the content out.

import { el, clear, chip } from "./dom.js";

/**
 * @param {HTMLElement} container
 * @param {{visible: boolean, knownMiss: {title:string, summary:string, outOfScope:string[], overReporting?:string}}} data
 */
export function renderKnownMiss(container, { visible, knownMiss }) {
  clear(container);
  container.hidden = !visible;
  if (!visible) return;

  container.appendChild(
    el("div", { class: "known-miss-title" }, [el("span", {}, knownMiss.title), chip("rule")])
  );
  container.appendChild(el("p", { class: "known-miss-summary" }, knownMiss.summary));
  container.appendChild(
    el(
      "ul",
      { class: "known-miss-list" },
      knownMiss.outOfScope.map((item) => el("li", {}, item))
    )
  );
  if (knownMiss.overReporting) {
    // R-10: the disclosure in the other direction — where this detector
    // over-fires on legitimate text, not where it misses a hidden one.
    container.appendChild(el("p", { class: "known-miss-summary" }, knownMiss.overReporting));
  }
  container.appendChild(
    el(
      "p",
      { class: "known-miss-test" },
      "This is asserted by a passing test: test_known_miss_base64_remains_undetected. The day we fix it, that test fails loudly."
    )
  );
}
