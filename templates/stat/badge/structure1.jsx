import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
/** Compact stat: small accent badge on top, big number, source line below. */
export default function StatBadge({ content, style }) {
  const frame = useCurrentFrame();
  const { number, label, source, caption } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  const op = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: palette.background ?? "#0b0b12", color: palette.foreground ?? "#fff", padding: 80, fontFamily: style.font?.heading ?? "Inter, sans-serif", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start" }}>
      <div style={{ opacity: op }}>
        {label && (<span style={{ fontSize: 18, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: palette.accent ?? "#7c5cff", background: (palette.accent ?? "#7c5cff") + "22", padding: "6px 12px", borderRadius: 6 }}>{label}</span>)}
        <div style={{ fontSize: 180 * scale, fontWeight: 800, color: palette.foreground ?? "#fff", lineHeight: 1, marginTop: 24 }}>{number}</div>
        {source && <div style={{ fontSize: 22, marginTop: 20, opacity: 0.65 }}>Source: {source}</div>}
        {caption && <div style={{ fontSize: 24, marginTop: 16, opacity: 0.85, maxWidth: 800 }}>{caption}</div>}
      </div>
    </AbsoluteFill>
  );
}
