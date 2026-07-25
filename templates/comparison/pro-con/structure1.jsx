import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
/** Pros/cons two-panel: left = "good" items, right = "bad" items. */
export default function CompareProCon({ content, style }) {
  const frame = useCurrentFrame();
  const { title, items = [], caption } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  const half = Math.ceil(items.length / 2);
  const pros = items.slice(0, half);
  const cons = items.slice(half);
  const op = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const Panel = ({ items, head, color }) => (
    <div style={{ flex: 1, opacity: op }}>
      <div style={{ fontSize: 26, fontWeight: 700, color, marginBottom: 18 }}>{head}</div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 14 }}>
        {items.map((it, i) => {
          const d = i * 5;
          const o = interpolate(frame - d, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return <li key={i} style={{ opacity: o, fontSize: 26, display: "flex", gap: 14, alignItems: "flex-start" }}><span style={{ color, fontSize: 28 }}>{head === "Pros" ? "+" : "−"}</span><span>{it}</span></li>;
        })}
      </ul>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: palette.background ?? "#0b0b12", color: palette.foreground ?? "#fff", padding: 80, fontFamily: style.font?.heading ?? "Inter, sans-serif", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      {title && <h1 style={{ fontSize: 56 * scale, margin: 0, marginBottom: 40, textAlign: "center", fontWeight: 800 }}>{title}</h1>}
      <div style={{ display: "flex", gap: 56, alignItems: "flex-start" }}>
        <Panel items={pros} head="Pros" color={palette.accent ?? "#34d399"} />
        <div style={{ width: 2, background: palette.muted ?? "#2a2a40" }} />
        <Panel items={cons} head="Cons" color={palette.primary ?? "#ff6b6b"} />
      </div>
      {caption && <div style={{ marginTop: 36, fontSize: 22, opacity: 0.6, textAlign: "center" }}>{caption}</div>}
    </AbsoluteFill>
  );
}
