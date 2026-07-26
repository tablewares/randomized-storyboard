/**
 * Pure (no node built-ins) classification helper shared by:
 *
 *  - engine/pipeline2/resolveMedia.js — runs in Node, decides whether a
 *    `url` is remote (http(s)/data/blob/ftp/file) or a local path that needs
 *    to be staged into public/media/.
 *  - engine/pipeline3/Media.jsx        — runs in the browser during Remotion
 *    render. It needs the SAME classification so the structure components can
 *    branch on `isStatic` without importing any node built-ins (Remotion's
 *    browser bundle fails if a structure transitively imports `node:fs`).
 *
 * Keep this module dependency-free so both contexts can import it.
 */

const REMOTE_RE = /^(https?:|data:|blob:|ftp:|file:)/i;

/** True if a url string is a remote scheme (http, https, data, blob, ftp, file). */
export function isRemoteUrl(url) {
  return typeof url === "string" && REMOTE_RE.test(url);
}

/**
 * Quick predicate used by structure JSX: should this resolved entry go
 * through Remotion's staticFile() or be used verbatim as a remote URL?
 *
 * @param {{ url?: string, isStatic?: boolean } | string | undefined} entry
 * @returns {boolean}
 */
export function isStaticMedia(entry) {
  if (!entry) return false;
  if (typeof entry === "string") return !isRemoteUrl(entry);
  return Boolean(entry.isStatic);
}
