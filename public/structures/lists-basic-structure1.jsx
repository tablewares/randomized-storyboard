import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

/**
 * Reference shape every template structure file implements:
 *   props.content  - validated/truncated StoryboardContent (see registry.ts)
 *   props.style    - merged StandardStyleVars for this scene
 *   props.animation- the animation preset name declared by this variation
 *
 * Structure files own their own animation timing via useCurrentFrame(); the
 * engine only tells them *when* they're on screen (via the outer Sequence),
 * not how to animate internally.
 */
export default function ListBasicDefault({ content, style }) {
  const frame = useCurrentFrame();
  const { title, description, items = [] } = content;
  const palette = style.palette ?? {};

  return (
    <AbsoluteFill
      style={{
        background: palette.background ?? "#0b0b10",
        color: palette.foreground ?? "#fff",
        padding: 80,
        fontFamily: style.font?.heading ?? "Inter, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 64 * (style.font?.scale ?? 1), margin: 0 }}>{title}</h1>
      {description && <p style={{ fontSize: 28, opacity: 0.8, maxWidth: 800 }}>{description}</p>}

      <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 24 }}>
        {items.map((item, i) => {
          const delay = i * 6; // stagger-fade-in
          const opacity = interpolate(frame - delay, [0, 15], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
          const translateY = interpolate(frame - delay, [0, 15], [20, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
          return (
            <div
              key={i}
              style={{
                opacity,
                transform: `translateY(${translateY}px)`,
                display: "flex",
                gap: 16,
                alignItems: "center",
              }}
            >
              <span style={{ color: palette.accent ?? "#7c5cff", fontSize: 32, fontWeight: 700 }}>{i + 1}</span>
              <span style={{ fontSize: 32 }}>{item}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
