import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { Media } from "../../../engine/pipeline3/Media.jsx";
/** Row of up to 3 images each with a caption below. */
export default function GalleryCaptionedRow({ content, style }) {
  const frame = useCurrentFrame();
  const { title, images = [], caption } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  return (
    <AbsoluteFill style={{ background: palette.background ?? "#0b0b12", color: palette.foreground ?? "#fff", padding: 80, fontFamily: style.font?.heading ?? "Inter, sans-serif", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      {title && <h1 style={{ fontSize: 50 * scale, margin: 0, marginBottom: 32, fontWeight: 800, textAlign: "center" }}>{title}</h1>}
      <div style={{ display: "flex", gap: 22, justifyContent: "center" }}>
        {images.slice(0, 3).map((im, i) => {
          const d = i * 7;
          const o = interpolate(frame - d, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const y = interpolate(frame - d, [0, 14], [40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={i} style={{ opacity: o, transform: `translateY(${y}px)`, flex: "0 1 280px" }}>
              <div style={{ width: "100%", aspectRatio: "4/3", borderRadius: 14, overflow: "hidden", background: palette.muted ?? "#222" }}>
                <Media src={im} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{ marginTop: 14, fontSize: 20, opacity: 0.85 }}>{im?.alt ?? ""}</div>
            </div>
          );
        })}
      </div>
      {caption && <div style={{ marginTop: 36, fontSize: 22, opacity: 0.6, textAlign: "center" }}>{caption}</div>}
    </AbsoluteFill>
  );
}
