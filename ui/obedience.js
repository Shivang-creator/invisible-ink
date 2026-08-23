// ui/obedience.js — the Obedience Table. Graceful absence is the acceptance
// criterion (T-22): when data/obedience.js has no usable cells, this module
// removes its own container from the DOM instead of rendering an empty
// table. Rows are sorted ascending by compliance rate so the encoding the
// model ignored is the first row a reader meets, not buried.

import { el, clear, chip, formatCount } from "./dom.js";

const CONTROL_ARMS = new Set(["plain-visible", "none"]);

/**
 * @param {HTMLElement} container
 * @param {{model:string, ranAt:string, canary:string, cells:{arm:string, n:number, complied:number, rate:number}[]}} obedience
 * @returns {boolean} false when the panel removed itself
 */
export function renderObedience(container, obedience) {
  clear(container);
  if (!obedience || !Array.isArray(obedience.cells) || obedience.cells.length === 0) {
    container.remove();
    return false;
  }

  container.appendChild(
    el("div", { class: "obedience-header" }, [
      el("span", { class: "obedience-title" }, "The Obedience Table"),
      chip("cached"),
    ])
  );
  container.appendChild(
    el(
      "p",
      { class: "obedience-meta" },
      `model ${obedience.model} · ranAt ${obedience.ranAt} · graded by a deterministic substring check for a canary token, not by a model judging a model`
    )
  );

  const sorted = [...obedience.cells].sort((a, b) => a.rate - b.rate);

  const rows = sorted.map((cell) => {
    const pct = Math.round(cell.rate * 100);
    return el("tr", {}, [
      el("td", {}, [
        el("span", {}, cell.arm),
        CONTROL_ARMS.has(cell.arm) ? el("span", { class: "obedience-control-chip" }, "control") : null,
      ]),
      el("td", {}, formatCount(cell.n)),
      el("td", {}, formatCount(cell.complied)),
      el("td", { class: "obedience-bar-cell" }, [
        el("div", { class: "obedience-bar-track" }, [
          el("div", { class: "obedience-bar-fill", style: `width:${pct}%` }),
        ]),
      ]),
      el("td", {}, `${pct}%`),
    ]);
  });

  const table = el("table", { class: "obedience-table" }, [
    el("thead", {}, [
      el("tr", {}, [
        el("th", {}, "arm"),
        el("th", {}, "n"),
        el("th", {}, "complied"),
        el("th", {}, ""),
        el("th", {}, "rate"),
      ]),
    ]),
    el("tbody", {}, rows),
  ]);

  container.appendChild(el("div", { class: "obedience-table-wrap" }, [table]));
  return true;
}
