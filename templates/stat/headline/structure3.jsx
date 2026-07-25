import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
/** Count-up variant: rolls the number from 0 to target over ~40 frames. */
export default function StatHeadlineCount({ content, style }) {
  const frame = useCurrentFrame();
  const { number, label, caption } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  const target = typeof number === "number" ? number : parseFloat(String(number).replace(/[^0-9.\-]/g, "")) || 0;
  const raw = String(number);
  const prefix = raw.match(/^[^0-9.\-]+/)?.[0] ?? "";
  const suffix = raw.match(/[^0-9.\-]+$/)?.[0] ?? "";
  const t = interpolate(frame, [6, 46], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const isFloat = target % 1 !== 0;
  const shown = isFloat ? (target * t).toFixed(1) : Math.round(target * t);
  return (
    <AbsoluteFill style={{ background: palette.background ?? "#0b0b12", color: palette.foreground ?? "#fff", padding: 80, fontFamily: style.font?.heading ?? "Inter, sans-serif", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start" }}>
      <div style={{ fontSize: 200 * scale, fontWeight: 800, color: palette.accent ?? "#7c5cff", lineHeight: 1 }}>
        {prefix}{shown}{suffix}
      </div>
      {label && <div style={{ fontSize: 38 * scale, marginTop: 28, opacity: 0.92, maxWidth: 900 }}>{label}</div>}
      {caption && <div style={{ fontSize: 22, marginTop: 22, opacity: 0.6 }}>{caption}</div>}
    </AbsoluteFill>
  );
}
