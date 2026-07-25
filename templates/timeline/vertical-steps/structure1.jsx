import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
/** Vertical timeline with dated items. Each item = {date, label, body}. */
export default function TimelineVertical({ content, style }) {
  const frame = useCurrentFrame();
  const { title, items = [], caption } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  return (
    <AbsoluteFill style={{ background: palette.background ?? "#0b0b12", color: palette.foreground ?? "#fff", padding: 80, fontFamily: style.font?.heading ?? "Inter, sans-serif", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      {title && <h1 style={{ fontSize: 52 * scale, margin: 0, marginBottom: 40, fontWeight: 800 }}>{title}</h1>}
      <div style={{ position: "relative", paddingLeft: 36 }}>
        <div style={{ position: "absolute", left: 14, top: 4, bottom: 4, width: 3, background: palette.muted ?? "#2a2a40" }} />
        <div style={{ position: "absolute", left: 14, top: 4, width: 3, background: palette.accent ?? "#7c5cff", height: `${Math.min(100, frame * 1.5)}%` }} />
        {items.map((it, i) => {
          const d = i * 8;
          const o = interpolate(frame - d, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const x = interpolate(frame - d, [0, 14], [-30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={i} style={{ opacity: o, transform: `translateX(${x}px)`, position: "relative", marginBottom: 32 }}>
              <div style={{ position: "absolute", left: -36, top: 6, width: 18, height: 18, borderRadius: "50%", background: palette.accent ?? "#7c5cff", border: `4px solid ${palette.background ?? "#0b0b12"}` }} />
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: palette.accent ?? "#7c5cff", opacity: 0.85 }}>{typeof it === "string" ? `Item ${i + 1}` : it?.date ?? `Item ${i + 1}`}</div>
              <div style={{ fontSize: 30, fontWeight: 700, marginTop: 6 }}>{typeof it === "string" ? it : it?.title ?? it?.label ?? ""}</div>
            </div>
          );
        })}
      </div>
      {caption && <div style={{ marginTop: 36, fontSize: 22, opacity: 0.6 }}>{caption}</div>}
    </AbsoluteFill>
  );
}
