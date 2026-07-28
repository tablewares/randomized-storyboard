import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readdir, stat, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

import { discoverTemplates } from "../engine/templates/discovery.js";
import { hydrateDefaultContent } from "../engine/contentKeys/defaults.js";
import { renderVariationVideo, renderVariationPoster, VIDEO_DIR, POSTER_DIR } from "./render.mjs";

export default defineConfig({
  root: __dirname,
  server: {
    port: 5174,
    fs: { allow: [repoRoot] },
  },
  plugins: [react(), apiPlugin(), staticAssetsPlugin()],
  resolve: {
    alias: {
      "@engine": path.resolve(repoRoot, "engine"),
      "@templates": path.resolve(repoRoot, "templates"),
    },
  },
});

let payloadCache = null;
async function buildTemplatesPayload() {
  if (payloadCache) return payloadCache;
  const templatesRoot = path.join(repoRoot, "templates");
  const { registry, families, issues } = await discoverTemplates(templatesRoot);
  const templates = [];
  for (const [templateId, t] of registry.entries()) {
    const safeFamily = t.family.replace(/\//g, "-");
    const safeId = t.id.replace(/\//g, "-");
    const { content: defaultContent } = hydrateDefaultContent(t.supportedContentKeys);
    for (const v of t.variations ?? []) {
      const structureKey = `${safeFamily}-${safeId}-${v.structure}`;
      const structureAbs = path.join(t.dir, v.structure);
      const structureImportPath = structureAbs.replace(/\\/g, "/");
      templates.push({
        templateId,
        family: t.family,
        description: t.description ?? "",
        keywords: t.keywords ?? [],
        variationId: v.id,
        structureKey,
        structureImportPath,
        animation: v.animation,
        style: v.style ?? {},
        defaultContent,
      });
    }
  }
  payloadCache = { templates, families: Object.fromEntries(families.entries()), issues };
  return payloadCache;
}

/**
 * Per-process render queue state. The worker runs once per server boot and
 * renders every variation sequentially: posters first (cheap fill-ins) then
 * MP4s. The client polls /api/videos/status to swap placeholder cards for
 * <video> tags as each file becomes ready.
 */
const renderStatus = {
  ready: new Map(), // structureKey -> true
  pending: new Set(),
  error: new Map(),
  started: false,
};

async function startRenderWorker(variations) {
  if (renderStatus.started) return;
  renderStatus.started = true;
  (async () => {
    // Phase 1: posters (fast) so the client can show a first-frame thumbnail
    // within seconds of boot.
    for (const v of variations) {
      if (renderStatus.ready.has("poster:" + v.structureKey)) continue;
      renderStatus.pending.add("poster:" + v.structureKey);
      try {
        await renderVariationPoster(v);
        renderStatus.ready.set("poster:" + v.structureKey, true);
      } catch (err) {
        renderStatus.error.set("poster:" + v.structureKey, String(err?.message ?? err));
      } finally {
        renderStatus.pending.delete("poster:" + v.structureKey);
      }
    }
    // Phase 2: MP4s (slow).
    for (const v of variations) {
      if (renderStatus.ready.has("video:" + v.structureKey)) continue;
      renderStatus.pending.add("video:" + v.structureKey);
      try {
        await renderVariationVideo(v);
        renderStatus.ready.set("video:" + v.structureKey, true);
      } catch (err) {
        renderStatus.error.set("video:" + v.structureKey, String(err?.message ?? err));
      } finally {
        renderStatus.pending.delete("video:" + v.structureKey);
      }
    }
    console.log("[render] worker finished. ready:", renderStatus.ready.size);
  })().catch((err) => console.error("[render] worker crashed:", err));
}

function apiPlugin() {
  return {
    name: "templates-preview-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next();
        if (req.url === "/api/templates" || req.url === "/api/templates/") {
          const payload = await buildTemplatesPayload();
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(payload));
          // Kick off the render worker lazily on first payload build, so a
          // server that starts with no client requests doesn't burn CPU.
          if (!renderStatus.started) {
            startRenderWorker(payload.templates.map((t) => ({
              structureKey: t.structureKey,
              defaultContent: t.defaultContent,
              style: t.style,
              animation: t.animation,
            })));
          }
          return;
        }
        if (req.url === "/api/videos/status" || req.url === "/api/videos/status/") {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            ready: Object.keys(Object.fromEntries(renderStatus.ready)),
            pending: Array.from(renderStatus.pending),
            errors: Object.fromEntries(renderStatus.error),
          }));
          return;
        }
        next();
      });
    },
  };
}

/** Streams cached MP4/PNG files from server/.cache. */
function staticAssetsPlugin() {
  return {
    name: "templates-preview-assets",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "";
        const m = url.match(/^\/(video|poster)\/([^?]+)\.(mp4|png)$/);
        if (!m) return next();
        const [, kind, key, ext] = m;
        const dir = kind === "video" ? VIDEO_DIR : POSTER_DIR;
        const file = path.join(dir, `${key}.${ext}`);
        if (!existsSync(file)) { res.statusCode = 404; res.end("not found"); return; }
        try {
          const data = await readFile(file);
          res.setHeader("Content-Type", kind === "video" ? "video/mp4" : "image/png");
          res.setHeader("Content-Length", data.length);
          res.setHeader("Cache-Control", "public, max-age=3600");
          res.end(data);
        } catch (err) {
          res.statusCode = 500;
          res.end(String(err?.message ?? err));
        }
      });
    },
  };
}
