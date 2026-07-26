import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { Media } from "../../../engine/pipeline3/Media.jsx";
/** Image grid: renders up to 4 images as square tiles with captions if present. */
export default function GalleryGrid({ content, style }) {
  const frame = useCurrentFrame();
  const { title, images = [], caption } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  const cols = images.length >= 4 ? 2 : images.length || 1;
  return (
    <AbsoluteFill style={{ background: palette.background ?? "#0b0b12", color: palette.foreground ?? "#fff", padding: 80, fontFamily: style.font?.heading ?? "Inter, sans-serif", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      {title && <h1 style={{ fontSize: 50 * scale, margin: 0, marginBottom: 32, fontWeight: 800, textAlign: "center" }}>{title}</h1>}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 18, maxWidth: 900, margin: "0 auto" }}>
        {images.map((im, i) => {
          const d = i * 6;
          const o = interpolate(frame - d, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const sc = interpolate(frame - d, [0, 14], [0.85, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={i} style={{ opacity: o, transform: `scale(${sc})`, aspectRatio: "1", borderRadius: 14, overflow: "hidden", background: palette.muted ?? "#222" }}>
              <Media src={im} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          );
        })}
      </div>
      {caption && <div style={{ marginTop: 36, fontSize: 22, opacity: 0.6, textAlign: "center" }}>{caption}</div>}
    </AbsoluteFill>
  );
}
