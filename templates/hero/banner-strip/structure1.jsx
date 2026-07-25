import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
/** Banner-style hero: title pinned near bottom of the screen. */
export default function HeroBanner({ content, style }) {
  const frame = useCurrentFrame();
  const { title, subtitle, label } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  const op = interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(frame, [0, 20], [40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: palette.background ?? "#0b0b12", color: palette.foreground ?? "#fff", fontFamily: style.font?.heading ?? "Inter, sans-serif", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 80, paddingBottom: 96 }}>
      <div style={{ opacity: op, transform: `translateY(${y}px)` }}>
        {label && <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: palette.accent ?? "#7c5cff", marginBottom: 18 }}>{label}</div>}
        <h1 style={{ fontSize: 78 * scale, margin: 0, fontWeight: 800, lineHeight: 1.05, maxWidth: 1300 }}>{title}</h1>
        {subtitle && <h2 style={{ fontSize: 30 * scale, margin: 0, marginTop: 22, opacity: 0.85, fontWeight: 400 }}>{subtitle}</h2>}
      </div>
    </AbsoluteFill>
  );
}
