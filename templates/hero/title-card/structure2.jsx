import React from "react";
import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
/** Pop-in title card: title scales in with a spring. */
export default function HeroTitleCardPop({ content, style }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { title, subtitle, caption } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  const s = spring({ frame, fps, config: { damping: 11, stiffness: 90 } });
  const subOp = interpolate(frame, [16, 32], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: palette.background ?? "#111417", color: palette.foreground ?? "#fff", padding: 80, fontFamily: style.font?.heading ?? "Inter, sans-serif", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
      <h1 style={{ fontSize: 100 * scale, margin: 0, fontWeight: 800, transform: `scale(${s})`, maxWidth: 1300 }}>{title}</h1>
      {subtitle && <h2 style={{ opacity: subOp, fontSize: 38 * scale, margin: 0, marginTop: 28, fontWeight: 400, maxWidth: 1000 }}>{subtitle}</h2>}
      {caption && <p style={{ opacity: subOp * 0.7, fontSize: 22, marginTop: 24 }}>{caption}</p>}
    </AbsoluteFill>
  );
}
