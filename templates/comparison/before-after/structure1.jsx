import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
/** Before/after: left column fades, then right column slides in from the right. */
export default function CompareBeforeAfter({ content, style }) {
  const frame = useCurrentFrame();
  const { title, label, value, items = [], caption } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  const beforeX = interpolate(frame, [0, 12], [-30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const beforeOp = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const afterX = interpolate(frame, [14, 30], [60, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const afterOp = interpolate(frame, [14, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const beforeTag = label ?? "Before";
  const afterTag = value ?? "After";
  return (
    <AbsoluteFill style={{ background: palette.background ?? "#0b0b12", color: palette.foreground ?? "#fff", padding: 80, fontFamily: style.font?.heading ?? "Inter, sans-serif", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      {title && <h1 style={{ fontSize: 56 * scale, margin: 0, marginBottom: 36, textAlign: "center", fontWeight: 800 }}>{title}</h1>}
      <div style={{ display: "flex", gap: 24, alignItems: "stretch" }}>
        <div style={{ flex: 1, opacity: beforeOp, transform: `translateX(${beforeX}px)`, border: `2px solid ${palette.muted ?? "#2a2a40"}`, borderRadius: 18, padding: 32 }}>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", opacity: 0.6 }}>{beforeTag}</div>
          <div style={{ fontSize: 40 * scale, marginTop: 18, fontWeight: 700, color: palette.muted ?? "#888" }}>{items[0] ?? ""}</div>
          <div style={{ fontSize: 20, marginTop: 14, opacity: 0.7 }}>{items[1] ?? ""}</div>
        </div>
        <div style={{ flex: 1, opacity: afterOp, transform: `translateX(${afterX}px)`, border: `2px solid ${palette.accent ?? "#7c5cff"}`, borderRadius: 18, padding: 32, background: (palette.accent ?? "#7c5cff") + "14" }}>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: palette.accent ?? "#7c5cff" }}>{afterTag}</div>
          <div style={{ fontSize: 40 * scale, marginTop: 18, fontWeight: 800, color: palette.accent ?? "#7c5cff" }}>{items[2] ?? ""}</div>
          <div style={{ fontSize: 20, marginTop: 14, opacity: 0.85 }}>{items[3] ?? ""}</div>
        </div>
      </div>
      {caption && <div style={{ marginTop: 32, fontSize: 22, opacity: 0.6, textAlign: "center" }}>{caption}</div>}
    </AbsoluteFill>
  );
}
