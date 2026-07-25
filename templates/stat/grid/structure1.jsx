import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
/** Grid of up to 4 stats, each = {number, label} pair derived from items. */
export default function StatGrid({ content, style }) {
  const frame = useCurrentFrame();
  const { number, label, items = [], caption } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  // Build card rows: pair the headline number/label as the first card if provided.
  const cards = [];
  if (number !== undefined) cards.push({ n: number, l: label ?? "" });
  for (let i = 0; i + 1 < items.length; i += 2) {
    cards.push({ n: String(items[i]), l: String(items[i + 1] ?? "") });
  }
  return (
    <AbsoluteFill style={{ background: palette.background ?? "#0b0b12", color: palette.foreground ?? "#fff", padding: 80, fontFamily: style.font?.heading ?? "Inter, sans-serif", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(2, cards.length)}, 1fr)`, gap: 36 }}>
        {cards.map((c, i) => {
          const delay = i * 6;
          const op = interpolate(frame - delay, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const y = interpolate(frame - delay, [0, 14], [20, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={i} style={{ opacity: op, transform: `translateY(${y}px)`, border: `2px solid ${palette.muted ?? "#2a2a40"}`, borderRadius: 18, padding: 32 }}>
              <div style={{ fontSize: 96 * scale, fontWeight: 800, color: palette.accent ?? "#7c5cff", lineHeight: 1 }}>{c.n}</div>
              {c.l && <div style={{ fontSize: 22, marginTop: 14, opacity: 0.85 }}>{c.l}</div>}
            </div>
          );
        })}
      </div>
      {caption && <div style={{ marginTop: 32, fontSize: 22, opacity: 0.65, textAlign: "center" }}>{caption}</div>}
    </AbsoluteFill>
  );
}
