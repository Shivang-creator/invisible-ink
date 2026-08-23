// ui/killSwitch.js — pure renderer for the Kill-Switch Proof. app.js computes
// two things and hands both to this module:
//   (1) `ledgerHash` — a single structural fact: buildLedgerHash(report,
//       clean) has no `explanations` parameter, so no explanation prose has
//       a path into it. One measurement, printed once, never labelled as a
//       comparison.
//   (2) `domOnHash`/`domOffHash` — the real two-condition experiment: the
//       explanation-layer toggle is actually flipped ON then OFF and the
//       Ledger panel's live rendered HTML is hashed in each state. This one
//       genuinely compares two different things, because the toggle really
//       was in two different states when each hash was taken.
//
// R-03 (2026-08-24, pc-red-team): the previous version called the same hash
// function twice with identical arguments and labelled the results "model
// ON" / "model OFF" — a tautology presented as an experiment. This module
// now only ever renders results that came from a real state change.

import { el, clear, chip, shortDigest } from "./dom.js";

/**
 * @param {HTMLElement} container
 * @param {{ledgerHash:string, domOnHash:string, domOffHash:string, domIdentical:boolean, elapsedMs:number, onProve:()=>void}} data
 */
export function renderKillSwitch(container, { ledgerHash, domOnHash, domOffHash, domIdentical, elapsedMs, onProve }) {
  clear(container);

  container.appendChild(
    el("div", { class: "kill-switch-header" }, [
      el("span", { class: "kill-switch-title" }, "Kill-Switch Proof"),
      chip("observed"),
    ])
  );
  container.appendChild(
    el(
      "p",
      {
        class: "kill-switch-desc",
        title: `buildLedgerHash takes no explanations argument at all (structural, not measured): ${ledgerHash}`,
      },
      "Toggle actually flipped ON/OFF; Ledger panel's own rendered HTML hashed each time — a real comparison."
    )
  );

  container.appendChild(
    el("div", { class: "kill-switch-row" }, [
      el("span", { class: "kill-switch-row-label", title: "toggle ON" }, "ON"),
      el("code", { class: "kill-switch-digest", title: domOnHash }, shortDigest(domOnHash)),
    ])
  );
  container.appendChild(
    el("div", { class: "kill-switch-row" }, [
      el("span", { class: "kill-switch-row-label", title: "toggle OFF" }, "OFF"),
      el("code", { class: "kill-switch-digest", title: domOffHash }, shortDigest(domOffHash)),
    ])
  );

  container.appendChild(
    el("div", { class: "kill-switch-verdict" }, [
      domIdentical
        ? el("span", { class: "kill-switch-verdict-text ok" }, "IDENTICAL ✓")
        : el("span", { class: "kill-switch-verdict-text bad" }, "NOT IDENTICAL — this is a real failure"),
      el("span", { class: "kill-switch-elapsed" }, `computed in ${Math.round(elapsedMs)} ms`),
    ])
  );

  container.appendChild(
    el("div", { class: "kill-switch-repro" }, [
      el("span", {}, [el("span", {}, "Same guarantee in one command: "), el("code", { class: "strip-code" }, "npm run killswitch")]),
      el("button", { type: "button", class: "kill-switch-prove-btn", onClick: onProve }, "Prove identical"),
    ])
  );
}
