import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
/** Big number with a leading accent block (icon stand-in) to its left. */
export default function StatWithIcon({ content, style }) {
  const frame = useCurrentFrame();
  const { number, label, caption } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  const op = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const wob = interpolate(frame, [0, 30], [0, 6 * Math.sin(frame / 4)], { extrapolateLeft: "clamp", extrapolateRight: "extend" });
  return (
    <AbsoluteFill style={{ background: palette.background ?? "#0b0b12", color: palette.foreground ?? "#fff", padding: 80, fontFamily: style.font?.heading ?? "Inter, sans-serif", display: "flex", flexDirection: "row", alignItems: "center", gap: 32 }}>
      <div style={{ width: 12, height: 220, background: palette.accent ?? "#7c5cff", borderRadius: 6, transform: `translateY(${wob}px)` }} />
      <div style={{ opacity: op }}>
        <div style={{ fontSize: 180 * scale, fontWeight: 800, lineHeight: 1 }}>{number}</div>
        {label && <div style={{ fontSize: 34 * scale, marginTop: 18, opacity: 0.9 }}>{label}</div>}
        {caption && <div style={{ fontSize: 22, marginTop: 14, opacity: 0.6, maxWidth: 700 }}>{caption}</div>}
      </div>
    </AbsoluteFill>
  );
}
