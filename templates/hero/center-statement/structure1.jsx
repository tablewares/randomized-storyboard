import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
/** Centered single-statement hero. Minimal. */
export default function HeroCenterStatement({ content, style }) {
  const frame = useCurrentFrame();
  const { title, subtitle, caption } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  const op = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: palette.background ?? "#0b0b12", color: palette.foreground ?? "#fff", padding: 100, fontFamily: style.font?.heading ?? "Inter, sans-serif", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
      <div style={{ opacity: op, maxWidth: 1300 }}>
        <h1 style={{ fontSize: 84 * scale, margin: 0, fontWeight: 700, lineHeight: 1.1 }}>{title}</h1>
        {subtitle && <h2 style={{ fontSize: 32 * scale, margin: 0, marginTop: 32, opacity: 0.8, fontWeight: 400 }}>{subtitle}</h2>}
        {caption && <p style={{ fontSize: 22, marginTop: 28, opacity: 0.55 }}>{caption}</p>}
      </div>
    </AbsoluteFill>
  );
}
