import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
/** Hero that leads with a large quote-style line, then a title underneath. */
export default function HeroQuote({ content, style }) {
  const frame = useCurrentFrame();
  const { quote, title, source, caption } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  const op = interpolate(frame, [0, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: palette.background ?? "#0b0b12", color: palette.foreground ?? "#fff", padding: 80, fontFamily: style.font?.heading ?? "Georgia, serif", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ opacity: op }}>
        <div style={{ fontSize: 96 * scale, color: palette.accent ?? "#ff6b6b", lineHeight: 1 }}>"</div>
        <blockquote style={{ margin: 0, fontSize: 56 * scale, fontStyle: "italic", lineHeight: 1.25, maxWidth: 1200 }}>{quote}</blockquote>
        {title && <h2 style={{ marginTop: 40, fontSize: 30 * scale, fontStyle: "normal", opacity: 0.9, fontWeight: 400 }}>{title}</h2>}
        {source && <div style={{ marginTop: 16, fontSize: 22, opacity: 0.6 }}>— {source}</div>}
        {caption && <p style={{ marginTop: 12, fontSize: 20, opacity: 0.45 }}>{caption}</p>}
      </div>
    </AbsoluteFill>
  );
}
