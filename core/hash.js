// core/hash.js — the one deliberately environment-aware file in core/, and even
// so it is one code path: `globalThis.crypto.subtle` exists in both Node 24+
// and every judge's browser, so there is no branch between them. No network,
// no model.

/**
 * @param {string} str
 * @returns {Promise<string>} lowercase hex SHA-256 digest
 */
export async function sha256Hex(str) {
  const bytes = new TextEncoder().encode(str);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
