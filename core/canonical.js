// core/canonical.js — pure. No imports from outside core/, no network, no model.
//
// canonicalJSON(obj) produces a stable string serialization: object keys are
// sorted, numbers are formatted with a fixed representation. Two structurally
// equal objects always serialize identically, regardless of property insertion
// order — this is the string the kill-switch proof hashes.

function formatNumber(n) {
  if (Number.isInteger(n)) return String(n);
  // Fixed precision for non-integers so floating point noise never changes the
  // hash between two runs that are otherwise identical.
  return n.toFixed(10).replace(/0+$/, "").replace(/\.$/, ".0");
}

function canonicalize(value) {
  if (value === null || value === undefined) return "null";
  const type = typeof value;
  if (type === "number") return formatNumber(value);
  if (type === "boolean") return value ? "true" : "false";
  if (type === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  if (type === "object") {
    const keys = Object.keys(value).sort();
    const parts = keys.map((k) => JSON.stringify(k) + ":" + canonicalize(value[k]));
    return "{" + parts.join(",") + "}";
  }
  // Functions, symbols, etc. have no place in canonicalized data.
  throw new TypeError(`canonicalJSON: unsupported value type "${type}"`);
}

/**
 * @param {*} obj
 * @returns {string}
 */
export function canonicalJSON(obj) {
  return canonicalize(obj);
}
