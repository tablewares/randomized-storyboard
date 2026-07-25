import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
/** Comparison rendered as a checklist of features (items), two labeled frames via label/value. */
export default function CompareChecklist({ content, style }) {
  const frame = useCurrentFrame();
  const { title, label, value, items = [], caption } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  return (
    <AbsoluteFill style={{ background: palette.background ?? "#0b0b12", color: palette.foreground ?? "#fff", padding: 80, fontFamily: style.font?.heading ?? "Inter, sans-serif", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      {title && <h1 style={{ fontSize: 52 * scale, margin: 0, marginBottom: 12, fontWeight: 800 }}>{title}</h1>}
      <div style={{ display: "flex", gap: 24, marginBottom: 36, fontSize: 24 }}>
        {label && <span style={{ opacity: 0.6 }}>{label}</span>}
        {value && <span style={{ color: palette.accent, fontWeight: 700 }}>{value}</span>}
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 16 }}>
        {items.map((it, i) => {
          const d = i * 6;
          const o = interpolate(frame - d, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const x = interpolate(frame - d, [0, 12], [-20, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <li key={i} style={{ opacity: o, transform: `translateX(${x}px)`, fontSize: 30, display: "flex", gap: 18, alignItems: "center" }}>
              <span style={{ color: palette.accent ?? "#34d399", fontSize: 34 }}>✓</span>
              <span>{it}</span>
            </li>
          );
        })}
      </ul>
      {caption && <div style={{ marginTop: 30, fontSize: 20, opacity: 0.55 }}>{caption}</div>}
    </AbsoluteFill>
  );
}
