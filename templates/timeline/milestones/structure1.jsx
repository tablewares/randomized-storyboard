import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
/** Milestones: a row of cards labelled with numbers from items[0..n]. */
export default function TimelineMilestones({ content, style }) {
  const frame = useCurrentFrame();
  const { title, number, items = [], caption } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  const seed = number !== undefined ? String(number) : "";
  return (
    <AbsoluteFill style={{ background: palette.background ?? "#0b0b12", color: palette.foreground ?? "#fff", padding: 80, fontFamily: style.font?.heading ?? "Inter, sans-serif", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      {title && <h1 style={{ fontSize: 50 * scale, margin: 0, marginBottom: 44, fontWeight: 800, textAlign: "center" }}>{title}</h1>}
      <div style={{ display: "flex", gap: 22, justifyContent: "center", alignItems: "stretch" }}>
        {items.map((it, i) => {
          const d = i * 7;
          const o = interpolate(frame - d, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const y = interpolate(frame - d, [0, 14], [40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={i} style={{ opacity: o, transform: `translateY(${y}px)`, flex: "1 1 0", maxWidth: 260, border: `2px solid ${palette.muted ?? "#2a2a40"}`, borderRadius: 16, padding: 26, textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: palette.accent ?? "#7c5cff" }}>{seed || `M${i + 1}`}</div>
              <div style={{ fontSize: 22, marginTop: 14 }}>{it}</div>
            </div>
          );
        })}
      </div>
      {caption && <div style={{ marginTop: 36, fontSize: 22, opacity: 0.6, textAlign: "center" }}>{caption}</div>}
    </AbsoluteFill>
  );
}
