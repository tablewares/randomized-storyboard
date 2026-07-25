import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
/** Stacked deck of images, each sliding into view per frame. */
export default function GalleryStack({ content, style }) {
  const frame = useCurrentFrame();
  const { title, images = [], caption } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  return (
    <AbsoluteFill style={{ background: palette.background ?? "#0b0b12", color: palette.foreground ?? "#fff", padding: 80, fontFamily: style.font?.heading ?? "Inter, sans-serif", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
      {title && <h1 style={{ fontSize: 50 * scale, margin: 0, marginBottom: 36, fontWeight: 800, textAlign: "center" }}>{title}</h1>}
      <div style={{ position: "relative", width: 520, height: 360 }}>
        {images.map((im, i) => {
          const d = i * 8;
          const o = interpolate(frame - d, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const x = interpolate(frame - d, [0, 14], [120, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={i} style={{ position: "absolute", inset: 0, opacity: o, transform: `translateX(${x}px) rotate(${(i % 2 ? -1 : 1) * 1.5}deg)`, borderRadius: 16, overflow: "hidden", boxShadow: `0 12px 40px ${palette.background ?? "#000"}66` }}>
              {im?.url ? <img src={im.url} alt={im.alt ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
            </div>
          );
        })}
      </div>
      {caption && <div style={{ marginTop: 36, fontSize: 22, opacity: 0.6, textAlign: "center" }}>{caption}</div>}
    </AbsoluteFill>
  );
}
