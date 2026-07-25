import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
/** Split layout: large title left, byline + date right. */
export default function HeroSplitByline({ content, style }) {
  const frame = useCurrentFrame();
  const { title, subtitle, author, date, caption } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  const op = interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: palette.background ?? "#0b0b12", color: palette.foreground ?? "#fff", padding: 80, fontFamily: style.font?.heading ?? "Inter, sans-serif", display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 60, alignItems: "center" }}>
      <div style={{ opacity: op }}>
        <h1 style={{ fontSize: 80 * scale, margin: 0, fontWeight: 800, lineHeight: 1.05 }}>{title}</h1>
        {subtitle && <h2 style={{ fontSize: 30 * scale, margin: 0, marginTop: 24, opacity: 0.85, fontWeight: 400 }}>{subtitle}</h2>}
        {caption && <p style={{ fontSize: 22, marginTop: 24, opacity: 0.6 }}>{caption}</p>}
      </div>
      <div style={{ opacity: op, borderLeft: `4px solid ${palette.accent ?? "#7c5cff"}`, paddingLeft: 32 }}>
        {author && <div style={{ fontSize: 30, fontWeight: 600 }}>{author}</div>}
        {date && <div style={{ fontSize: 22, opacity: 0.7, marginTop: 8 }}>{date}</div>}
        <div style={{ marginTop: 28, fontSize: 20, opacity: 0.5 }}>— {author ? "by " + author : ""}</div>
      </div>
    </AbsoluteFill>
  );
}
