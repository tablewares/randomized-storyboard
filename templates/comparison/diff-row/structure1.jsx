import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
/** Diff rows: shared foundation row + two diverging outcome rows. */
export default function CompareDiffRow({ content, style }) {
  const frame = useCurrentFrame();
  const { title, label, value, items = [], caption } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  const Row = ({ head, body, color, delay }) => {
    const op = interpolate(frame - delay, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const x = interpolate(frame - delay, [0, 12], [-30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (
      <div style={{ opacity: op, transform: `translateX(${x}px)`, display: "flex", gap: 24, alignItems: "baseline", padding: "20px 0", borderBottom: `1px solid ${palette.muted ?? "#2a2a40"}` }}>
        <div style={{ minWidth: 220, fontSize: 24, fontWeight: 700, color }}>{head}</div>
        <div style={{ fontSize: 26, opacity: 0.85 }}>{body}</div>
      </div>
    );
  };
  return (
    <AbsoluteFill style={{ background: palette.background ?? "#0b0b12", color: palette.foreground ?? "#fff", padding: 80, fontFamily: style.font?.heading ?? "Inter, sans-serif", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      {title && <h1 style={{ fontSize: 50 * scale, margin: 0, marginBottom: 28, fontWeight: 800 }}>{title}</h1>}
      <Row head={label ?? "Baseline"} body={items[0] ?? ""} color={palette.foreground} delay={0} />
      <Row head="Option A" body={items[1] ?? ""} color={palette.accent ?? "#38bdf8"} delay={6} />
      <Row head="Option B" body={items[2] ?? ""} color={palette.primary ?? "#ff6b6b"} delay={12} />
      {value && <div style={{ marginTop: 24, fontSize: 24, color: palette.accent ?? "#38bdf8" }}>{value}</div>}
      {caption && <p style={{ marginTop: 14, fontSize: 20, opacity: 0.55 }}>{caption}</p>}
    </AbsoluteFill>
  );
}
