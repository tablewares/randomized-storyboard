import React, { useEffect, useState, useRef, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { Player } from "@remotion/player";

const root = createRoot(document.getElementById("root"));

function useRoute() {
  const [path, setPath] = useState(() => window.location.hash.slice(1) || "/");
  useEffect(() => {
    const onHash = () => setPath(window.location.hash.slice(1) || "/");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return path;
}

function useTemplates() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    fetch("/api/templates")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch(setError);
  }, []);
  return data;
}

// ESM modules cache keyed by structureImportPath.
const moduleCache = new Map();
function loadStructure(structureImportPath) {
  if (moduleCache.has(structureImportPath)) return moduleCache.get(structureImportPath);
  // Vite serves files outside root via the /@fs/ scheme when fs.allow covers them.
  const url = "/@fs" + structureImportPath;
  const promise = import(/* @vite-ignore */ url).then((m) => {
    moduleCache.set(structureImportPath, m);
    return m;
  });
  moduleCache.set(structureImportPath, promise);
  return promise;
}

function App() {
  const route = useRoute();
  const data = useTemplates();
  if (!data) return <div style={{ padding: 24 }}>Loading templates…</div>;

  // Route shape: /preview/<encoded templateId>/<variationId>
  const m = route.match(/^\/preview\/([^/]+)\/([^/]+)$/);
  if (m) {
    const templateId = decodeURIComponent(m[1]);
    const variationId = decodeURIComponent(m[2]);
    const variation = data.templates.find(
      (t) => t.templateId === templateId && t.variationId === variationId
    );
    if (!variation) return <Missing id={`${templateId}/${variationId}`} />;
    return <PreviewView variation={variation} />;
  }

  return <Gallery templates={data.templates} families={data.families} issues={data.issues} />;
}

function Gallery({ templates, families, issues }) {
  const [visibleCount, setVisibleCount] = useState(12);
  const sentinelRef = useRef(null);

  // Flatten for pagination while keeping family grouping intact —
  // we slice the flat list, THEN regroup the visible slice by family,
  // so family sections grow naturally as more cards appear.
  const flat = templates;
  const visible = flat.slice(0, visibleCount);
  const byFamily = new Map();
  for (const t of visible) {
    const list = byFamily.get(t.family) ?? [];
    list.push(t);
    byFamily.set(t.family, list);
  }

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && visibleCount < flat.length) {
            setVisibleCount((n) => Math.min(n + 12, flat.length));
          }
        }
      },
      { rootMargin: "400px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visibleCount, flat.length]);

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <h1 style={{ fontWeight: 600, fontSize: 28 }}>Template Preview Gallery</h1>
      <p style={{ opacity: 0.7, marginTop: 4 }}>
        {templates.length} variations across {families ? Object.keys(families).length : "??"} families · showing {visible.length} · click any card to preview at 1080×1920
      </p>
      {issues?.length > 0 && (
        <details style={{ margin: "12px 0", color: "#f5a623" }}>
          <summary>{issues.length} discovery issue(s)</summary>
          <pre style={{ overflow: "auto", fontSize: 12 }}>{JSON.stringify(issues, null, 2)}</pre>
        </details>
      )}
      <input
        type="search"
        placeholder="filter by templateId / keyword / family"
        onChange={(e) => {
          const q = e.target.value.toLowerCase();
          document.querySelectorAll("[data-searchable]").forEach((el) => {
            el.style.display = el.dataset.searchable.includes(q) ? "" : "none";
          });
        }}
        style={{ width: "100%", maxWidth: 480, padding: 8, marginTop: 12, marginBottom: 20, background: "#1a1a20", color: "#e8e8ea", border: "1px solid #2a2a33", borderRadius: 4 }}
      />
      {Array.from(byFamily.entries()).map(([family, vars]) => (
        <section key={family} style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, borderBottom: "1px solid #2a2a33", paddingBottom: 6, marginBottom: 12 }}>
            {family} <span style={{ opacity: 0.5, fontWeight: 400 }}>· {vars.length}</span>
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {vars.map((v) => (
              <GalleryCard key={`${v.templateId}/${v.variationId}`} v={v} />
            ))}
          </div>
        </section>
      ))}
      {visibleCount < flat.length && (
        <div ref={sentinelRef} style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.5 }}>
          loading more…
        </div>
      )}
    </div>
  );
}

function Missing({ id }) {
  return <div style={{ padding: 24 }}>No variation found for <code>{id}</code>.</div>;
}

/**
 * Gallery card thumbnail served from a pre-rendered MP4 of the variation.
 * Pre-render pipeline: server/render.mjs (via @remotion/renderer, chromium
 * headless) writes server/.cache/{videos,posters}/<structureKey>.{mp4,png};
 * server/vite.config.js boots a background worker that renders them serially
 * and surfaces progress via /api/videos/status.
 *
 * CPU/memory discipline (two layers):
 *   1. The parent Gallery paginates — only ~12 cards live in DOM per page;
 *      infinitely scrolling still caps live cards at one page at a time
 *      (visibleCount grows but already-played cards keep their video element
 *      attached, see note below on pause-when-offscreen).
 *   2. This card's IntersectionObserver does NOT unobserve after first
 *      intersect — it stays attached and flips play()/pause() as the card
 *      enters/leaves the viewport. Videos past the viewport are paused so
 *      the browser can drop decoded-frame buffers; only near-card videos
 *      actually decode. Paired with preload="none" + muted autoplay, the
 *      CPU load stays small regardless of how many cards have scrolled by.
 *
 * Poll-once-until-ready: the status endpoint poll self-terminates the moment
 * this card flips to "ready" (catches up to the boot-time render worker).
 *
 * Render specs changed from 270×480 @ 60f to 1080×1920 @ 150f — native canvas
 * resolution, no element-squishing (structures sized relative to canvas get
 * real coordinates they were designed for; CSS scales the MP4 down for
 * display via aspect-ratio on the wrapper).
 */
function GalleryCard({ v }) {
  const [status, setStatus] = useState("pending"); // pending | ready | error
  const [mounted, setMounted] = useState(false);   // <video> element exists
  const ref = useRef(null);
  const videoRef = useRef(null);
  const videoUrl = `/video/${encodeURIComponent(v.structureKey)}.mp4`;
  const posterUrl = `/poster/${encodeURIComponent(v.structureKey)}.png`;

  // Persistent IO — stays observing for the card's whole life. When in view,
  // mount the <video> (if not already) and call play(); when leaving, pause.
  // This is what keeps CPU flat regardless of how many cards scrolled past.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setMounted(true);
            // Defer play() until the element is actually painted.
            requestAnimationFrame(() => {
              const vid = videoRef.current;
              if (vid && vid.paused) {
                vid.play().catch(() => {/* autoplay may be blocked until interaction */});
              }
            });
          } else {
            const vid = videoRef.current;
            if (vid && !vid.paused) vid.pause();
          }
        }
      },
      { rootMargin: "150px", threshold: 0.05 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Discover render status — poll only while pending, self-terminate on ready.
  useEffect(() => {
    let alive = true;
    let id = null;
    const check = async () => {
      try {
        // Cheap probe: HEAD the actual file. 200 means served.
        const r = await fetch(videoUrl, { method: "HEAD" });
        if (r.ok) { if (alive) setStatus("ready"); return false; }
      } catch {}
      try {
        const r = await fetch("/api/videos/status");
        const j = await r.json();
        if (j.ready?.includes("video:" + v.structureKey)) { if (alive) setStatus("ready"); return false; }
        if (j.errors?.["video:" + v.structureKey]) { if (alive) setStatus("error"); return false; }
      } catch {}
      return true; // keep polling
    };
    (async () => {
      let keep = await check();
      if (keep) {
        id = setInterval(async () => {
          keep = await check();
          if (!keep && id) { clearInterval(id); id = null; }
        }, 3000);
      }
    })();
    return () => { alive = false; if (id) clearInterval(id); };
  }, [v.structureKey, videoUrl]);

  const go = (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.location.hash = `#/preview/${encodeURIComponent(v.templateId)}/${encodeURIComponent(v.variationId)}`;
  };

  return (
    <div
      ref={ref}
      onClick={go}
      data-searchable={`${v.templateId} ${v.variationId} ${v.family} ${v.keywords?.join(" ") ?? ""}`.toLowerCase()}
      style={{
        display: "block",
        background: "#17171d",
        border: "1px solid #26262e",
        borderRadius: 6,
        overflow: "hidden",
        cursor: "pointer",
        transition: "border-color 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#4a73c7")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#26262e")}
    >
      {/* Native canvas aspect-ratio (1080/1920) — MP4 renders at full 1080×1920,
          CSS scales it to card width. No element squishing because the rendered
          pixels were laid out at the design resolution. */}
      <div style={{ width: "100%", aspectRatio: "1080 / 1920", background: "#0b0b10", position: "relative" }}>
        {mounted && status === "ready" ? (
          <video
            ref={videoRef}
            src={videoUrl}
            poster={posterUrl}
            muted
            loop
            playsInline
            preload="none"
            style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none", display: "block" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#555", fontSize: 12 }}>
            {status === "error" ? "render failed" : "rendering…"}
          </div>
        )}
      </div>
      <div style={{ padding: "10px 12px" }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "#e8e8ea" }}>{v.variationId}</div>
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{v.templateId}</div>
        <div style={{ fontSize: 12, opacity: 0.5, marginTop: 4 }}>{v.animation}</div>
      </div>
    </div>
  );
}

function PreviewView({ variation }) {
  const [mod, setMod] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    setError(null);
    setMod(null);
    loadStructure(variation.structureImportPath)
      .then(setMod)
      .catch((err) => setError(err));
  }, [variation.structureImportPath]);

  const Comp = mod?.default;
  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <a href="#/" style={{ fontSize: 14 }}>← back to gallery</a>
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 4px" }}>
        {variation.templateId} <span style={{ opacity: 0.5 }}>/ {variation.variationId}</span>
      </h1>
      <p style={{ opacity: 0.7, fontSize: 13, marginTop: 0, marginBottom: 8 }}>{variation.description}</p>
      <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 16 }}>
        family: {variation.family} · animation: {variation.animation}
      </div>

      {error ? (
        <div style={{ color: "#ff7a7a", padding: 12, background: "#2a1717", borderRadius: 6, fontFamily: "monospace" }}>
          Failed to load structure: <code>{variation.structureImportPath}</code>
          <pre style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{String(error.message ?? error)}</pre>
        </div>
      ) : !Comp ? (
        <div>Loading structure…</div>
      ) : (
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div
            style={{
              borderRadius: 8,
              overflow: "hidden",
              border: "1px solid #2a2a33",
              width: 360,
              height: 640,
            }}
          >
            <Player
              component={Comp}
              inputProps={{
                content: variation.defaultContent,
                style: variation.style,
                animation: variation.animation,
              }}
              durationInFrames={150}
              fps={30}
              compositionWidth={1080}
              compositionHeight={1920}
              style={{ width: "100%", height: "100%" }}
              controls
              loop
              autoPlay
            />
          </div>
          <div style={{ flex: 1, minWidth: 280 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 0 }}>Default content</h3>
            <pre style={{ background: "#17171d", padding: 12, borderRadius: 6, fontSize: 12, overflow: "auto", color: "#cfcfd8" }}>
              {JSON.stringify(variation.defaultContent, null, 2)}
            </pre>
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>Style</h3>
            <pre style={{ background: "#17171d", padding: 12, borderRadius: 6, fontSize: 12, overflow: "auto", color: "#cfcfd8" }}>
              {JSON.stringify(variation.style, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
