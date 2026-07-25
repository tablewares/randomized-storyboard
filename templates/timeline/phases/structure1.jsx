import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
/** Phases: 2-3 large blocks each labelled Phase N. */
export default function TimelinePhases({ content, style }) {
  const frame = useCurrentFrame();
  const { title, items = [], caption } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  return (
    <AbsoluteFill style={{ background: palette.background ?? "#0b0b12", color: palette.foreground ?? "#fff", padding: 80, fontFamily: style.font?.heading ?? "Inter, sans-serif", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      {title && <h1 style={{ fontSize: 52 * scale, margin: 0, marginBottom: 44, fontWeight: 800, textAlign: "center" }}>{title}</h1>}
      <div style={{ display: "flex", gap: 24 }}>
        {items.map((it, i) => {
          const d = i * 8;
          const o = interpolate(frame - d, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const y = interpolate(frame - d, [0, 14], [40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={i} style={{ opacity: o, transform: `translateY(${y}px)`, flex: 1, background: (palette.accent ?? "#7c5cff") + "12", borderLeft: `6px solid ${palette.accent ?? "#7c5cff"}`, borderRadius: 14, padding: 32 }}>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: palette.accent ?? "#7c5cff" }}>Phase {i + 1}</div>
              <div style={{ fontSize: 30, marginTop: 22 }}>{it}</div>
            </div>
          );
        })}
      </div>
      {caption && <div style={{ marginTop: 36, fontSize: 22, opacity: 0.6, textAlign: "center" }}>{caption}</div>}
    </AbsoluteFill>
  );
}
