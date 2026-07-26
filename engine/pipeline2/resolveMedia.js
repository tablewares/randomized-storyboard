import path from "node:path";
import { copyFile, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { isRemoteUrl, isStaticMedia } from "./mediaShared.js";

/**
 * Pipeline-2 media hydration.
 *
 * Storyboard `content` may carry media in these shapes (see the 17-key
 * registry in engine/contentKeys/registry.js):
 *
 *   image:    { url, alt? }                 (type: "image")
 *   icon:     { url, alt? }                 (type: "image")
 *   video:    { url, alt? }                 (type: "image" — a video source)
 *   images:   [{ url, alt? }, ...]         (type: "array" of ContentImage)
 *
 * The renderer contract in types.js says these `url`s are "remote url or
 * local path, resolved by the template's renderer". In practice the gallery
 * structures shoved `url` straight into `<img src=...>`, which works for
 * `http(s)://` URLs but breaks for local file paths — Remotion can only
 * open files served from the bundle's `public/` folder via `staticFile()`.
 *
 * resolveMediaContent walks the hydrated content, classifies each `url` as
 * remote (http/https/data) or local (a path on disk), copies local files
 * into `public/media/<basename>` if not already present, and rewrites each
 * resolved ContentImage to:
 *
 *   { url: <staticFile-safe basename OR original remote url>, alt?, isStatic: boolean }
 *
 * Structures read `isStatic` to decide between `staticFile(url)` (local) and
 * the raw `url` (remote) when feeding Remotion's <Img>/<Video>/<OffthreadVideo>.
 *
 * This runs inside pipeline 2 after the registry's
 * validateAndTruncateContent() pass, so only media keys the template
 * declared support for survive (unsupported keys were already dropped with a
 * warning). We DON'T invent new keys here — we only rewrite `url` payloads
 * on the surviving image-class keys: image, images, icon, video.
 *
 * @param {Object} content - the post-validation scene content
 * @param {Object} [opts]
 * @param {string} [opts.publicDir] - absolute path to the Remotion public/ folder.
 *        Defaults to "<repoRoot>/public". Relative paths resolved against process.cwd().
 * @returns {Promise<{ content: Object, mediaWarnings: string[] }>}
 */
export async function resolveMediaContent(content, opts = {}) {
  const publicDir = path.resolve(opts.publicDir ?? path.join(process.cwd(), "public"));
  const mediaDir = path.join(publicDir, "media");
  const warnings = [];

  if (!content || typeof content !== "object") return { content, mediaWarnings: warnings };

  const result = { ...content };

  for (const key of ["image", "icon", "video", "images"]) {
    const value = result[key];
    if (value == null) continue;

    if (key === "images") {
      if (!Array.isArray(value)) continue;
      result[key] = await Promise.all(
        value.map((entry, i) => resolveEntry(entry, mediaDir, warnings, `${key}[${i}]`, publicDir))
      );
    } else {
      result[key] = await resolveEntry(value, mediaDir, warnings, key, publicDir);
    }
  }

  return { content: result, mediaWarnings: warnings };
}

/**
 * Resolve one ContentImage (or a bare string shortcut) into the static-safe
 * shape { url, alt?, isStatic }.
 *
 * Bare strings are upgraded into the { url } shape — useful for storyboard
 * authors who write `"image": "/abs/path/to.png"` instead of the fuller object.
 */
async function resolveEntry(entry, mediaDir, warnings, keyTrace, publicDir) {
  // Allow the { rawString } shortcut.
  if (typeof entry === "string") entry = { url: entry };

  if (!entry || typeof entry !== "object" || !entry.url) {
    return entry; // nothing to resolve
  }

  const url = String(entry.url);
  const isRemote = isRemoteUrl(url);

  if (isRemote) {
    return { ...entry, url, isStatic: false };
  }

  // Local path: resolve to an absolute source.
  const srcAbs = path.isAbsolute(url) ? url : path.resolve(process.cwd(), url);

  if (!existsSync(srcAbs)) {
    warnings.push(`media ${keyTrace}.url="${url}" not found on disk — leaving as-is (render may fail).`);
    return { ...entry, url, isStatic: false };
  }

  const basename = path.basename(srcAbs);
  if (!basename) {
    warnings.push(`media ${keyTrace}.url="${url}" resolved to an empty filename — skipping.`);
    return { ...entry, url, isStatic: false };
  }

  // Copy into public/media/ so Remotion's staticFile() can serve it. Best-effort:
  // if the file already exists with identical size we skip the copy.
  const destPath = path.join(mediaDir, basename);
  try {
    await mkdir(mediaDir, { recursive: true });
    let needsCopy = true;
    if (existsSync(destPath)) {
      try {
        const [srcStat, dstStat] = await Promise.all([stat(srcAbs), stat(destPath)]);
        if (srcStat.size === dstStat.size && srcStat.mtimeMs <= dstStat.mtimeMs) needsCopy = false;
      } catch {
        /* fall through to copy */
      }
    }
    if (needsCopy) await copyFile(srcAbs, destPath);
  } catch (err) {
    warnings.push(`media ${keyTrace}: failed to copy "${srcAbs}" → "${destPath}" (${err.message}).`);
    return { ...entry, url, isStatic: false };
  }

  // staticFile() resolves basenames relative to public/, so "media/<basename>"
  // is what the renderer feeds Remotion's <Img src={staticFile("media/x.png")} />.
  return { ...entry, url: `media/${basename}`, isStatic: true };
}

// Re-export the pure classification helper so Node-side callers can import
// it from resolveMedia.js without reaching for the browser-side mediaShared
// module directly (both modules are node-builtin-free-safe for the shared
// helper, but Media.jsx in the browser imports from mediaShared.js directly).
export { isStaticMedia };
