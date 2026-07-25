import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
/** Horizontal linear timeline of items. Each node animates in. */
export default function TimelineLinear({ content, style }) {
  const frame = useCurrentFrame();
  const { title, items = [], caption } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  const n = Math.max(items.length, 1);
  const lineW = interpolate(frame, [6, 6 + n * 6], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: palette.background ?? "#0b0b12", color: palette.foreground ?? "#fff", padding: 80, fontFamily: style.font?.heading ?? "Inter, sans-serif", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      {title && <h1 style={{ fontSize: 56 * scale, margin: 0, marginBottom: 80, fontWeight: 800, textAlign: "center" }}>{title}</h1>}
      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "0 16px" }}>
        <div style={{ position: "absolute", top: 14, left: 16, right: 16, height: 4, background: palette.muted ?? "#2a2a40", borderRadius: 2 }} />
        <div style={{ position: "absolute", top: 14, left: 16, height: 4, background: palette.accent ?? "#7c5cff", borderRadius: 2, width: `${lineW}%` }} />
        {items.map((it, i) => {
          const d = i * 6;
          const o = interpolate(frame - d, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const sc = interpolate(frame - d, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", opacity: o }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: palette.accent ?? "#7c5cff", transform: `scale(${sc})`, marginBottom: 18 }} />
              <div style={{ fontSize: 18, fontWeight: 700, opacity: 0.55 }}>Step {i + 1}</div>
              <div style={{ fontSize: 22, marginTop: 6, maxWidth: 220 }}>{it}</div>
            </div>
          );
        })}
      </div>
      {caption && <div style={{ marginTop: 60, textAlign: "center", fontSize: 22, opacity: 0.6 }}>{caption}</div>}
    </AbsoluteFill>
  );
}
