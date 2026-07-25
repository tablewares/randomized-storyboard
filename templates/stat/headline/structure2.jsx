import React from "react";
import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
/** Pop-in variant: number springs into place. */
export default function StatHeadlinePop({ content, style }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { number, label, caption } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  const popScale = spring({ frame, fps, config: { damping: 9, stiffness: 120 } });
  const labelOpacity = interpolate(frame, [14, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: palette.background ?? "#111417", color: palette.foreground ?? "#fff", padding: 80, fontFamily: style.font?.heading ?? "Inter, sans-serif", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
      <div style={{ transform: `scale(${popScale})`, fontSize: 240 * scale, fontWeight: 800, color: palette.accent ?? "#ffcc00", lineHeight: 1 }}>{number}</div>
      {label && <div style={{ opacity: labelOpacity, fontSize: 44 * scale, marginTop: 32, maxWidth: 900 }}>{label}</div>}
      {caption && <div style={{ opacity: labelOpacity * 0.7, fontSize: 22, marginTop: 20 }}>{caption}</div>}
    </AbsoluteFill>
  );
}
