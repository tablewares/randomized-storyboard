import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
/** Big single stat. fade-up variant. */
export default function StatHeadline({ content, style }) {
  const frame = useCurrentFrame();
  const { number, label, caption } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(frame, [0, 18], [40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const numScale = interpolate(frame, [4, 28], [0.6, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: palette.background ?? "#0b0b12", color: palette.foreground ?? "#fff", padding: 80, fontFamily: style.font?.heading ?? "Inter, sans-serif", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start" }}>
      <div style={{ opacity, transform: `translateY(${y}px)` }}>
        <div style={{ fontSize: 220 * scale, fontWeight: 800, color: palette.accent ?? "#7c5cff", lineHeight: 1, transform: `scale(${numScale})`, transformOrigin: "left center" }}>{number}</div>
        {label && <div style={{ fontSize: 40 * scale, marginTop: 24, opacity: 0.92, maxWidth: 900 }}>{label}</div>}
        {caption && <div style={{ fontSize: 22, marginTop: 28, opacity: 0.6, maxWidth: 700 }}>{caption}</div>}
      </div>
    </AbsoluteFill>
  );
}
