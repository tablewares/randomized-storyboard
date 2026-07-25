import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
/** Tagline overlay: big title + small tag/badge above it. */
export default function HeroTaglineOverlay({ content, style }) {
  const frame = useCurrentFrame();
  const { title, label, subtitle, caption } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  const tagOp = interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [4, 22], [50, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleOp = interpolate(frame, [4, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 35%, ${palette.accent ?? "#7c5cff"}33, ${palette.background ?? "#0b0b12"} 60%)`, color: palette.foreground ?? "#fff", padding: 80, fontFamily: style.font?.heading ?? "Inter, sans-serif", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
      {label && <div style={{ opacity: tagOp, fontSize: 22, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", color: palette.accent ?? "#7c5cff" }}>{label}</div>}
      <h1 style={{ opacity: titleOp, transform: `translateY(${titleY}px)`, fontSize: 88 * scale, margin: 0, marginTop: 24, fontWeight: 800, maxWidth: 1200, lineHeight: 1.05 }}>{title}</h1>
      {subtitle && <h2 style={{ fontSize: 32 * scale, margin: 0, marginTop: 28, opacity: 0.85, fontWeight: 400 }}>{subtitle}</h2>}
      {caption && <p style={{ fontSize: 22, marginTop: 24, opacity: 0.55 }}>{caption}</p>}
    </AbsoluteFill>
  );
}
