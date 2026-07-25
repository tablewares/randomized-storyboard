import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
/** Title card: large headline + subtitle + caption. fade-up. */
export default function HeroTitleCard({ content, style }) {
  const frame = useCurrentFrame();
  const { title, subtitle, caption } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  const op = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(frame, [0, 18], [40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lineW = interpolate(frame, [10, 40], [0, 160], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: palette.background ?? "#0b0b12", color: palette.foreground ?? "#fff", padding: 80, fontFamily: style.font?.heading ?? "Inter, sans-serif", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ opacity: op, transform: `translateY(${y}px)` }}>
        <h1 style={{ fontSize: 96 * scale, margin: 0, fontWeight: 800, lineHeight: 1.05, maxWidth: 1200 }}>{title}</h1>
        {subtitle && <h2 style={{ fontSize: 36 * scale, margin: 0, marginTop: 28, opacity: 0.85, maxWidth: 900, fontWeight: 400 }}>{subtitle}</h2>}
        <div style={{ marginTop: 36, width: lineW, height: 6, background: palette.accent ?? "#7c5cff", borderRadius: 3 }} />
        {caption && <p style={{ fontSize: 22, marginTop: 28, opacity: 0.6, maxWidth: 700 }}>{caption}</p>}
      </div>
    </AbsoluteFill>
  );
}
