// app.js — orchestration, state machine and event wiring only. Every number
// rendered anywhere on this page traces back to core/detect.js's Report, to
// data/corpus.js, or to data/test-results.js; nothing here decides a finding.
// This file is the one place allowed to import both core/ and ui/.

import { toRecords } from "./core/codepoints.js";
import { analyze } from "./core/detect.js";
import { sanitize } from "./core/sanitize.js";
import { canonicalJSON } from "./core/canonical.js";
import { sha256Hex } from "./core/hash.js";

import rulepack from "./data/rulepack.v1.js";
import samples from "./data/samples.js";
import corpus from "./data/corpus.js";
import testResults from "./data/test-results.js";
import knownMissData from "./data/known-miss.js";

import { el, clear } from "./ui/dom.js";
import { renderCounter } from "./ui/counter.js";
import { renderRecovered } from "./ui/recovered.js";
import { initRevealPane, renderModelPane } from "./ui/revealPane.js";
import { initLedger, renderLedger } from "./ui/ledger.js";
import { renderSelfTestStrip } from "./ui/selfTest.js";
import { renderKillSwitch } from "./ui/killSwitch.js";
import { renderSanitizer } from "./ui/sanitizer.js";
import { renderKnownMiss } from "./ui/knownMiss.js";
import { renderObedience } from "./ui/obedience.js";
import { renderLegend } from "./ui/legend.js";
import { loadExplanations, getExplanation, setOn, isOn } from "./ui/modelLayer.js";

const TOO_LONG_LIMIT = 200000;
const SLOW_THRESHOLD_MS = 80;
const DEBOUNCE_MS = 250;
const SEVERITY_ORDER = ["critical", "high", "medium", "low"];

// ---- DOM refs -------------------------------------------------------------

const appEl = document.getElementById("app");
const rulepackBadge = document.getElementById("rulepackBadge");
const modelOnBtn = document.getElementById("modelOnBtn");
const modelOffBtn = document.getElementById("modelOffBtn");
const selfTestStripEl = document.getElementById("selfTestStrip");
const counterPanel = document.getElementById("counterPanel");
const recoveredPanel = document.getElementById("recoveredPanel");
const revealPaneEl = document.getElementById("revealPane");
const sampleButtonsEl = document.getElementById("sampleButtons");
const clearBtn = document.getElementById("clearBtn");
const ledgerPanel = document.getElementById("ledgerPanel");
const killSwitchPanel = document.getElementById("killSwitchPanel");
const sanitizerPanel = document.getElementById("sanitizerPanel");
const knownMissPanel = document.getElementById("knownMissPanel");
const obediencePanel = document.getElementById("obediencePanel");
const legendEl = document.getElementById("legend");
const liveRegion = document.getElementById("liveRegion");

// ---- module-scope state ----------------------------------------------------

let textarea = null;
let modelPaneEl = null;
let ledgerList = null;
let activeIndex = -1;
let isSlow = false;
let rafHandle = null;
let debounceHandle = null;
let pendingTooLongText = "";
let killSwitchGeneration = 0;
let explanations = {};
let lastGoodReport = null;
let lastGoodClean = "";

const SAMPLE_DEFS = [
  { key: "poisonedReadme", label: "Load poisoned README", extraClass: "" },
  { key: "jobDescription", label: "Load job description", extraClass: "" },
  { key: "knownMiss", label: "Load the payload we miss", extraClass: " sample-btn--known-miss" },
];

// ---- init -------------------------------------------------------------

rulepackBadge.textContent = `rulepack v${rulepack.version}`;
setOn(true);

const revealRefs = initRevealPane(revealPaneEl, { onActivateOffset: handleActivateOffset });
textarea = revealRefs.textarea;
modelPaneEl = revealRefs.modelPane;

const ledgerRefs = initLedger(ledgerPanel, { onActivate: handleActivateFinding, onCopy: handleCopy });
ledgerList = ledgerRefs.list;

buildSampleButtons();
renderKnownMiss(knownMissPanel, { visible: false, knownMiss: knownMissData });
renderLegend(legendEl, {
  rulepackVersion: rulepack.version,
  corpusSeed: corpus.seed,
  testResults,
});

textarea.addEventListener("input", scheduleAnalysis);
clearBtn.addEventListener("click", handleClear);
modelOnBtn.addEventListener("click", () => setModel(true));
modelOffBtn.addEventListener("click", () => setModel(false));

// Load the model layer's prose (optional by construction — see
// ui/modelLayer.js) before the first paint, then run the corpus self-test,
// then paint the hero sample. Nothing here blocks on a network request:
// loadExplanations resolves locally, from a same-origin ES module or not at
// all.
loadExplanations()
  .then((loaded) => {
    explanations = loaded;
  })
  .finally(() => {
    runSelfTest();
    textarea.value = samples.poisonedReadme;
    updateSampleButtonsPressed("poisonedReadme");
    runAnalysis(samples.poisonedReadme);
  });

// ---- self-test strip --------------------------------------------------

function runSelfTest() {
  const t0 = performance.now();
  let pass = 0;
  const failingIds = [];
  for (const testCase of corpus.cases) {
    const result = analyze(testCase.text, rulepack);
    const got = result.findings.map((f) => `${f.ruleId}:${f.start}:${f.end}`).sort();
    const want = testCase.expected.map((e) => `${e.ruleId}:${e.start}:${e.end}`).sort();
    const ok = got.length === want.length && got.every((v, i) => v === want[i]);
    if (ok) pass++;
    else failingIds.push(testCase.id);
  }
  const elapsedMs = performance.now() - t0;
  const corpusResult = { pass, total: corpus.cases.length, elapsedMs, seed: corpus.seed, failingIds };

  if (failingIds.length > 0) {
    console.error(
      `Self-test: ${failingIds.length} corpus case(s) failed in this browser: ${failingIds.join(", ")}`
    );
  }

  renderSelfTestStrip(selfTestStripEl, {
    corpusResult,
    testResults,
    onLoadCase: (id) => {
      const testCase = corpus.cases.find((c) => c.id === id);
      if (!testCase) return;
      textarea.value = testCase.text;
      updateSampleButtonsPressed(null);
      runAnalysis(testCase.text);
    },
  });
}

// ---- sample buttons -----------------------------------------------------

function buildSampleButtons() {
  clear(sampleButtonsEl);
  for (const def of SAMPLE_DEFS) {
    sampleButtonsEl.appendChild(
      el(
        "button",
        {
          type: "button",
          class: `sample-btn${def.extraClass}`,
          dataset: { sample: def.key },
          "aria-pressed": "false",
          onClick: () => handleLoadSample(def.key),
        },
        def.label
      )
    );
  }
}

function updateSampleButtonsPressed(activeKey) {
  for (const btn of sampleButtonsEl.querySelectorAll(".sample-btn")) {
    btn.setAttribute("aria-pressed", String(btn.dataset.sample === activeKey));
  }
}

function handleLoadSample(key) {
  if (key === "__truncate") {
    // Sentinel from the too-long panel's "Analyse the first 200,000" button
    // (ui/recovered.js). Not one of the three named samples.
    const truncated = pendingTooLongText.slice(0, TOO_LONG_LIMIT);
    textarea.value = truncated;
    updateSampleButtonsPressed(null);
    runAnalysis(truncated, { fromTruncate: true });
    return;
  }
  const text = samples[key];
  if (text === undefined) return;
  textarea.value = text;
  updateSampleButtonsPressed(key);
  runAnalysis(text);
  textarea.focus();
}

function handleClear() {
  textarea.value = "";
  updateSampleButtonsPressed(null);
  runAnalysis("");
  textarea.focus();
}

// ---- analysis pipeline --------------------------------------------------

function scheduleAnalysis() {
  const text = textarea.value;
  if (isSlow) {
    appEl.dataset.state = "analysing";
    liveRegion.textContent = `Analysing ${text.length.toLocaleString("en-US")} characters.`;
    clearTimeout(debounceHandle);
    debounceHandle = setTimeout(() => runAnalysis(text), DEBOUNCE_MS);
  } else {
    cancelAnimationFrame(rafHandle);
    rafHandle = requestAnimationFrame(() => runAnalysis(text));
  }
}

function runAnalysis(text, { fromTruncate = false } = {}) {
  cancelAnimationFrame(rafHandle);
  clearTimeout(debounceHandle);

  if (text.length === 0) {
    activeIndex = -1;
    render("empty", {});
    return;
  }

  if (text.length > TOO_LONG_LIMIT && !fromTruncate) {
    pendingTooLongText = text;
    render("too-long", { tooLongLength: text.length });
    return;
  }

  const t0 = performance.now();
  let report;
  try {
    report = analyze(text, rulepack);
  } catch (err) {
    console.error("Analysis failed:", err);
    render("error", { error: err });
    return;
  }
  const elapsed = performance.now() - t0;
  isSlow = elapsed > SLOW_THRESHOLD_MS;

  const records = toRecords(text);
  const { clean, removed } = sanitize(text, report);

  lastGoodReport = report;
  lastGoodClean = clean;
  activeIndex = -1;

  const mode = text === samples.knownMiss ? "known-miss" : report.findings.length === 0 ? "clean" : "findings";
  render(mode, { report, records, clean, removed, text });
}

function render(mode, extra) {
  appEl.dataset.state = mode;

  if (mode === "error") {
    renderRecovered(recoveredPanel, { mode, error: extra.error });
    liveRegion.textContent = "Analysis failed.";
    return; // counter, reveal pane, ledger, sanitizer stay frozen at last good
  }

  const report = extra.report || null;

  renderCounter(counterPanel, { report, mode });

  renderRecovered(recoveredPanel, {
    mode,
    report,
    rulepackRuleCount: rulepack.rules.length,
    tooLongLength: extra.tooLongLength,
    onLoadSample: handleLoadSample,
  });

  if (mode === "too-long") {
    renderModelPane(modelPaneEl, { records: [], report: null, mode, activeIndex });
  } else {
    renderModelPane(modelPaneEl, { records: extra.records || [], report, mode, activeIndex });
  }

  renderLedger(ledgerList, { report, mode, explanations, activeIndex });

  const hasFindings = Boolean(report && report.findings.length > 0);
  renderSanitizer(sanitizerPanel, {
    visible: hasFindings,
    clean: extra.clean || "",
    removed: extra.removed || [],
    onCopy: handleCopy,
    onReanalyzeClean: () => {
      const cleanText = extra.clean || "";
      textarea.value = cleanText;
      updateSampleButtonsPressed(null);
      runAnalysis(cleanText);
    },
  });

  renderKnownMiss(knownMissPanel, { visible: mode === "known-miss", knownMiss: knownMissData });

  updateKillSwitch(report, extra.clean ?? "");

  liveRegion.textContent = liveMessage(mode, report);
}

function liveMessage(mode, report) {
  if (mode === "empty") return "Empty.";
  if (mode === "too-long") return "Input too long.";
  if (mode === "clean") return "No findings. This text delivers exactly what it displays.";
  if (mode === "known-miss") return "No findings. This is the known miss.";
  if (mode === "findings" && report) {
    const sev = SEVERITY_ORDER.find((s) => report.findings.some((f) => f.severity === s));
    return `${report.findings.length} finding${report.findings.length === 1 ? "" : "s"}. Highest severity ${sev}.`;
  }
  return "";
}

// ---- activation: ledger row <-> reveal pane cell -------------------------

function handleActivateFinding(idx) {
  if (!lastGoodReport || !lastGoodReport.findings[idx]) return;
  activeIndex = idx;
  const finding = lastGoodReport.findings[idx];
  renderLedger(ledgerList, { report: lastGoodReport, mode: "findings", explanations, activeIndex });
  renderModelPane(modelPaneEl, {
    records: toRecords(textarea.value),
    report: lastGoodReport,
    mode: "findings",
    activeIndex,
  });
  const activeCell = modelPaneEl.querySelector(".cell--active");
  if (activeCell) activeCell.scrollIntoView({ block: "center", inline: "nearest" });
  const activeRow = ledgerList.querySelector(".ledger-row--active");
  if (activeRow) activeRow.scrollIntoView({ block: "nearest" });
  // Below 720px, skip stealing focus into the textarea: it opens the mobile
  // keyboard over the very result the row activation is meant to show.
  if (window.innerWidth >= 720) {
    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(finding.start, finding.end);
  }
}

function handleActivateOffset(offset) {
  if (!lastGoodReport) return;
  const idx = lastGoodReport.findings.findIndex((f) => f.start <= offset && offset < f.end);
  if (idx === -1) return;
  handleActivateFinding(idx);
}

// ---- model layer toggle: CSS-only, no re-render --------------------------

function setModel(on) {
  setOn(on);
  modelOnBtn.setAttribute("aria-pressed", String(on));
  modelOffBtn.setAttribute("aria-pressed", String(!on));
  liveRegion.textContent = `Explanation layer ${on ? "on" : "off"}. No numbers changed.`;
}

// ---- kill-switch proof ----------------------------------------------------
//
// R-03 (2026-08-24, pc-red-team): the previous version of this function
// called buildLedgerHash(effectiveReport, effectiveClean) twice with
// byte-identical arguments and labelled the two results "model ON" /
// "model OFF" -- f(x) === f(x) dressed up as a two-arm experiment. The
// underlying invariant was always true (buildLedgerHash takes no
// `explanations` parameter at all -- see below), but presenting a structural
// fact as a measured comparison is exactly the shape a hostile reader looks
// for. Fixed by reframing to the real experiment: the toggle is flipped for
// real (setOn(true) then setOn(false), the same calls the header buttons
// make) and the Ledger panel's own rendered HTML is captured and hashed in
// each state. renderLedger takes no model-on/off argument and never reads
// document.documentElement's data-model attribute, so if this ever printed
// two different hashes it would mean the toggle silently started reaching
// the render path -- a real failure, not a tautology.

async function buildLedgerHash(report, clean) {
  const ledger = {
    findings: report.findings,
    byRule: report.byRule,
    visibleLength: report.visibleLength,
    deliveredLength: report.deliveredLength,
    codepointCount: report.codepointCount,
    rulepackVersion: report.rulepackVersion,
    clean,
  };
  return sha256Hex(canonicalJSON(ledger));
}

async function updateKillSwitch(report, clean) {
  const generation = ++killSwitchGeneration;
  const effectiveReport = report || analyze("", rulepack);
  const effectiveClean = report ? clean : "";

  const t0 = performance.now();

  // Structural proof: buildLedgerHash(report, clean) has no third parameter
  // for explanation prose to enter through. One measurement, not two
  // identical ones pretending to be a comparison.
  const ledgerHash = await buildLedgerHash(effectiveReport, effectiveClean);

  // Real two-condition proof: actually flip the toggle (not a decoy
  // variable) and capture the Ledger panel's live rendered HTML in each
  // state, then restore whatever state the visitor had actually chosen.
  // The three setOn() calls run back-to-back with no `await` between them so
  // the browser never gets a paint opportunity in the "off" state — the
  // visitor never sees the flip, only the proof it happened.
  const wasOn = isOn();
  setOn(true);
  const domOn = ledgerPanel.innerHTML;
  setOn(false);
  const domOff = ledgerPanel.innerHTML;
  setOn(wasOn);
  const [domOnHash, domOffHash] = await Promise.all([sha256Hex(domOn), sha256Hex(domOff)]);

  const elapsedMs = performance.now() - t0;

  if (generation !== killSwitchGeneration) return; // superseded by a newer analysis

  const domIdentical = domOnHash === domOffHash;

  renderKillSwitch(killSwitchPanel, {
    ledgerHash,
    domOnHash,
    domOffHash,
    domIdentical,
    elapsedMs,
    onProve: () => updateKillSwitch(lastGoodReport, lastGoodClean),
  });

  if (!domIdentical) {
    console.error("Kill-switch mismatch: toggling the explanation layer changed the rendered Ledger. This must never happen.");
  }
}

// ---- obedience table (graceful absence) -----------------------------------

loadObedience().then((obedience) => {
  renderObedience(obediencePanel, obedience);
});

async function loadObedience() {
  try {
    const mod = await import("./data/obedience.js");
    return (mod && mod.default) || { cells: [] };
  } catch (err) {
    console.warn(
      "data/obedience.js is not present (T-16 may not have run yet, or it was cut by the freeze death order). " +
        "The Obedience Table removes itself from the DOM rather than shipping empty.",
      err
    );
    return { cells: [] };
  }
}

// ---- clipboard --------------------------------------------------------

async function handleCopy(text, btn) {
  const original = btn.textContent;
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = "Copied";
  } catch (err) {
    console.warn("Clipboard write blocked by the browser; falling back to manual select.", err);
    btn.textContent = "Select and copy — clipboard blocked by the browser";
    selectText(text);
  }
  setTimeout(() => {
    btn.textContent = original;
  }, 1200);
}

function selectText(text) {
  // Best-effort: put the text somewhere selectable so the user can Cmd/Ctrl+C
  // it manually when navigator.clipboard is unavailable (insecure context).
  const holder = document.createElement("textarea");
  holder.value = text;
  holder.style.position = "fixed";
  holder.style.opacity = "0";
  document.body.appendChild(holder);
  holder.focus();
  holder.select();
  document.body.removeChild(holder);
}
