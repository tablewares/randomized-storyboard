import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, stat } from "node:fs/promises";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const ENTRY_POINT = path.join(__dirname, "renderEntry.jsx");
const CACHE_DIR = path.join(__dirname, ".cache");
const VIDEO_DIR = path.join(CACHE_DIR, "videos");
const POSTER_DIR = path.join(CACHE_DIR, "posters");

const FPS = 30;
const DURATION_FRAMES = 150;
const WIDTH = 1080;
const HEIGHT = 1920;

/** Shared bundle promise — bundle once per process, reuse for every variation. */
let bundlePromise = null;
function getBundle() {
  if (!bundlePromise) {
    console.log("[render] bundling renderEntry.jsx …");
    bundlePromise = bundle({ entryPoint: ENTRY_POINT })
      .then((serveUrl) => { console.log("[render] bundle ready:", serveUrl); return serveUrl; })
      .catch((err) => { bundlePromise = null; throw err; });
  }
  return bundlePromise;
}

async function ensureDirs() {
  await mkdir(VIDEO_DIR, { recursive: true });
  await mkdir(POSTER_DIR, { recursive: true });
}

/** @param {string} key - variation.structureKey */
function videoPath(key) { return path.join(VIDEO_DIR, `${key}.mp4`); }
function posterPath(key) { return path.join(POSTER_DIR, `${key}.png`); }

async function existsNonEmpty(p) {
  try { const s = await stat(p); return s.size > 0; } catch { return false; }
}

/**
 * Render one variation to MP4. Skips if a non-empty file already exists.
 * Reuses the shared bundle. Resolves with the absolute output path.
 *
 * @param {{ structureKey: string, defaultContent: object, style: object, animation: string }} variation
 * @param {object} [opts]
 * @param {(p: { progress: number }) => void} [opts.onProgress]
 * @returns {Promise<string>}
 */
export async function renderVariationVideo(variation, opts = {}) {
  await ensureDirs();
  const out = videoPath(variation.structureKey);
  if (await existsNonEmpty(out)) return out;

  const serveUrl = await getBundle();
  const inputProps = { variation };

  const composition = await selectComposition({
    serveUrl,
    id: "SingleVariation",
    inputProps,
  });

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: out,
    inputProps,
    audioBitrate: "96k",
    crf: 26,
    onProgress: (p) => opts.onProgress?.(p),
  });
  return out;
}

/**
 * Render a single still frame (PNG) for use as the <video poster> before
 * the MP4 is ready. Cheap relative to a full video render (~1s each).
 *
 * @param {{ structureKey: string, defaultContent: object, style: object, animation: string }} variation
 * @param {object} [opts] - opts.frame defaults to 30 (mid-animation)
 * @returns {Promise<string>}
 */
export async function renderVariationPoster(variation, opts = {}) {
  await ensureDirs();
  const out = posterPath(variation.structureKey);
  if (await existsNonEmpty(out)) return out;

  const serveUrl = await getBundle();
  const inputProps = { variation };

  const composition = await selectComposition({
    serveUrl,
    id: "SingleVariation",
    inputProps,
  });

  const result = await renderStill({
    composition,
    serveUrl,
    outputLocation: out,
    frame: opts.frame ?? 30,
    imageFormat: "png",
    inputProps,
  });
  // renderStill in v4.0.499 returns { buffer, contentType } rather than
  // honoring outputLocation for the default image-format path — write the
  // buffer ourselves so the cache file actually lands on disk.
  if (result?.buffer) {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(out, result.buffer);
  }
  return out;
}

export { VIDEO_DIR, POSTER_DIR };
