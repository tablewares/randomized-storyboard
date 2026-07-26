import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { Media } from "../../../engine/pipeline3/Media.jsx";
/** Collage: irregular grid of up to 4 images anchored at the corners. */
export default function GalleryCollage({ content, style }) {
  const frame = useCurrentFrame();
  const { images = [], title, caption } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  return (
    <AbsoluteFill style={{ background: palette.background ?? "#0b0b12", color: palette.foreground ?? "#fff", padding: 80, fontFamily: style.font?.heading ?? "Inter, sans-serif", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
      {title && <h1 style={{ fontSize: 50 * scale, margin: 0, marginBottom: 32, fontWeight: 800, textAlign: "center" }}>{title}</h1>}
      <div style={{ position: "relative", width: 880, height: 480 }}>
        {images.slice(0, 4).map((im, i) => {
          const d = i * 6;
          const o = interpolate(frame - d, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const sc = interpolate(frame - d, [0, 14], [0.7, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const spots = [
            { left: 0, top: 0, width: 420, height: 280 },
            { right: 0, top: 0, width: 420, height: 220 },
            { left: 0, bottom: 0, width: 420, height: 180 },
            { right: 0, bottom: 0, width: 420, height: 280 },
          ];
          const s = spots[i] ?? {};
          return (
            <div key={i} style={{ position: "absolute", ...s, opacity: o, transform: `scale(${sc})`, transformOrigin: "center", borderRadius: 16, overflow: "hidden", boxShadow: `0 8px 30px ${palette.background ?? "#000"}55` }}>
              <Media src={im} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          );
        })}
      </div>
      {caption && <div style={{ marginTop: 32, fontSize: 22, opacity: 0.6, textAlign: "center" }}>{caption}</div>}
    </AbsoluteFill>
  );
}
