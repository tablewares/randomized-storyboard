import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
/** Journey: a stepped vertical list with a propagating accent bar. */
export default function TimelineJourney({ content, style }) {
  const frame = useCurrentFrame();
  const { title, items = [], caption } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  return (
    <AbsoluteFill style={{ background: palette.background ?? "#0b0b12", color: palette.foreground ?? "#fff", padding: 80, fontFamily: style.font?.heading ?? "Inter, sans-serif", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      {title && <h1 style={{ fontSize: 48 * scale, margin: 0, marginBottom: 36, fontWeight: 800, textAlign: "center" }}>{title}</h1>}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {items.map((it, i) => {
          const d = i * 6;
          const o = interpolate(frame - d, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const barW = interpolate(frame - d, [0, 18], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const last = i === items.length - 1;
          return (
            <div key={i} style={{ opacity: o, display: "flex", alignItems: "center", gap: 24, padding: "16px 0", borderBottom: last ? "none" : `1px solid ${palette.muted ?? "#2a2a40"}` }}>
              <div style={{ width: 72, textAlign: "right", fontSize: 30, fontWeight: 800, color: palette.accent ?? "#7c5cff" }}>{i + 1}</div>
              <div style={{ flex: 1, fontSize: 28 }}>{it}</div>
              <div style={{ width: 180, height: 6, borderRadius: 3, background: palette.muted ?? "#2a2a40", overflow: "hidden" }}>
                <div style={{ width: `${barW}%`, height: "100%", background: palette.accent ?? "#7c5cff", borderRadius: 3 }} />
              </div>
            </div>
          );
        })}
      </div>
      {caption && <div style={{ marginTop: 32, fontSize: 20, opacity: 0.55, textAlign: "center" }}>{caption}</div>}
    </AbsoluteFill>
  );
}
