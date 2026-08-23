// ui/sanitizer.js — the cleaned-text pane and its removed[] summary. Reads
// exactly what core/sanitize.js returned; the only per-row arithmetic here is
// counting how many codepoints a already-decided span covers for the label
// ("87 codepoints"), via spreading the string — the same iteration
// core/codepoints.js#toRecords uses, not a new decision about what to flag.

import { el, clear, chip } from "./dom.js";

/**
 * @param {HTMLElement} container
 * @param {{
 *   visible: boolean,
 *   clean: string,
 *   removed: object[],
 *   onCopy: (text:string, btn:HTMLElement)=>void,
 *   onReanalyzeClean: ()=>void,
 * }} data
 */
export function renderSanitizer(container, { visible, clean, removed, onCopy, onReanalyzeClean }) {
  clear(container);
  container.hidden = !visible;
  if (!visible) return;

  container.appendChild(
    el("div", { class: "sanitizer-title" }, [el("span", {}, "The Sanitizer"), chip("observed")])
  );

  container.appendChild(el("pre", { class: "sanitizer-clean" }, clean));

  const removedCodeUnits = removed.reduce((sum, r) => sum + (r.original.length - r.replacement.length), 0);
  const headline = `${removed.length} payload${removed.length === 1 ? "" : "s"} removed — ${removedCodeUnits} code unit${
    removedCodeUnits === 1 ? "" : "s"
  } removed — ${clean.length} character${clean.length === 1 ? "" : "s"} remain`;

  const rows = removed.map((r) => {
    const codepointCount = [...r.original].length;
    const isReplace = r.class === "HG";
    const text = isReplace
      ? `${r.ruleId} replaced ${codepointCount} codepoint${codepointCount === 1 ? "" : "s"} at [${r.start}, ${r.end}): "${r.original}" → "${r.replacement}"`
      : `${r.ruleId} removed ${codepointCount} codepoint${codepointCount === 1 ? "" : "s"} at [${r.start}, ${r.end})`;
    return el("div", {}, text);
  });

  const side = el("div", { class: "sanitizer-side" }, [
    el("div", { class: "sanitizer-headline" }, headline),
    el("div", { class: "sanitizer-removed-list" }, rows),
    el("div", { class: "sanitizer-actions" }, [
      el(
        "button",
        {
          type: "button",
          class: "sanitizer-btn",
          onClick: (e) => onCopy(clean, e.currentTarget),
        },
        "Copy clean text"
      ),
      el(
        "button",
        { type: "button", class: "sanitizer-btn", onClick: onReanalyzeClean },
        "Re-analyse the clean copy"
      ),
    ]),
  ]);

  container.appendChild(side);
}
