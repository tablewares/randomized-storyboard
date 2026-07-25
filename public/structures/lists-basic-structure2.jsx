import React from "react";
import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig } from "remotion";

/** Same content/style contract as structure1.jsx - different layout + animation (pop-in). */
export default function ListBasicBoldNumbered({ content, style }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { title, items = [] } = content;
  const palette = style.palette ?? {};

  return (
    <AbsoluteFill
      style={{
        background: palette.background ?? "#111417",
        color: palette.foreground ?? "#fff",
        padding: 80,
        fontFamily: style.font?.heading ?? "Inter, sans-serif",
        justifyContent: "center",
      }}
    >
      <h1 style={{ fontSize: 56 * (style.font?.scale ?? 1), marginBottom: 48 }}>{title}</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {items.map((item, i) => {
          const scale = spring({ frame: frame - i * 5, fps, config: { damping: 12 } });
          return (
            <div key={i} style={{ display: "flex", gap: 24, alignItems: "center", transform: `scale(${scale})` }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: palette.accent ?? "#ffcc00",
                  color: "#000",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  fontWeight: 800,
                }}
              >
                {i + 1}
              </div>
              <span style={{ fontSize: 36, fontWeight: 600 }}>{item}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
