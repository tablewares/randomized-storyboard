import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
/** Two stats side by side. */
export default function StatTwoUp({ content, style }) {
  const frame = useCurrentFrame();
  const { number, label, value, source, caption } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  const op = interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: palette.background ?? "#0b0b12", color: palette.foreground ?? "#fff", padding: 80, fontFamily: style.font?.heading ?? "Inter, sans-serif", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ display: "flex", gap: 60, opacity: op }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 160 * scale, fontWeight: 800, color: palette.accent ?? "#7c5cff", lineHeight: 1 }}>{number}</div>
          {label && <div style={{ fontSize: 30, marginTop: 18, opacity: 0.85 }}>{label}</div>}
        </div>
        <div style={{ width: 2, background: palette.muted ?? "#333" }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 160 * scale, fontWeight: 800, color: palette.primary ?? "#f5f5f7", lineHeight: 1 }}>{value}</div>
          {source && <div style={{ fontSize: 30, marginTop: 18, opacity: 0.85 }}>{source}</div>}
        </div>
      </div>
      {caption && <div style={{ marginTop: 40, fontSize: 22, opacity: 0.6, textAlign: "center" }}>{caption}</div>}
    </AbsoluteFill>
  );
}
