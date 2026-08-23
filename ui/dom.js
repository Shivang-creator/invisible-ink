// ui/dom.js — tiny DOM-building helpers shared by every ui/*.js module.
// Formatting only. No detection, no offset math, no verdicts: this file turns
// data that already exists on a Report into DOM nodes and nothing else.

/**
 * Build one element. `props.dataset` sets data-* attributes; any key starting
 * with "on" and holding a function is wired as an event listener; "class",
 * "text" and "html" are shorthands. Everything else becomes an attribute.
 * `props.html` is used only for literal, hand-written strings already in this
 * codebase (never for pasted or user-controlled text).
 * @param {string} tag
 * @param {object} [props]
 * @param {(Node|string|null|false)[]|Node|string} [kids]
 * @returns {HTMLElement}
 */
export function el(tag, props = {}, kids = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "html") node.innerHTML = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) {
      node.setAttribute(key, "");
    } else {
      node.setAttribute(key, String(value));
    }
  }
  appendKids(node, kids);
  return node;
}

function appendKids(node, kids) {
  const list = Array.isArray(kids) ? kids : [kids];
  for (const kid of list) {
    if (kid === null || kid === undefined || kid === false) continue;
    node.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
  }
}

/** Remove every child of a node. */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/**
 * One of the five epistemic tag chips. `kind` is lowercase:
 * observed | rule | cached | generated | simulated.
 * @param {string} kind
 * @param {string} [label]
 * @returns {HTMLElement}
 */
export function chip(kind, label) {
  return el("span", { class: `chip chip--${kind}` }, label || kind.toUpperCase());
}

/**
 * Format a numeric codepoint as an uppercase 4+ digit hex string with no
 * base prefix — the cell grid shows `200B`, the citation/aria text adds the
 * `U+` on top of this. Pure formatting: one method call, no manual lookup
 * tables or arithmetic on the codepoint's bit pattern.
 * @param {number} cp
 * @returns {string}
 */
export function hex(cp) {
  return cp.toString(16).toUpperCase().padStart(4, "0");
}

/** Thousands-separated integer, for user-facing counts only. */
export function formatCount(n) {
  return Number(n).toLocaleString("en-US");
}

/** First-6 + ... + last-6 of a long hex digest, full value kept in `title`. */
export function shortDigest(hexStr) {
  if (!hexStr || hexStr.length <= 16) return hexStr || "";
  return `${hexStr.slice(0, 6)}...${hexStr.slice(-6)}`;
}
