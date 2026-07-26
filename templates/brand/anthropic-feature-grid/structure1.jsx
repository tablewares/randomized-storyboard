import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

/**
 * Anthropic feature-card grid (cream variation).
 * Maps to DESIGN.md `feature-card` + feature-card-grid:
 *   background = surface-card (#efe9de), rounded 12px, padding 32px.
 * Headlines in serif (Copernicus substitute), body in Inter.
 * Each item is a card; up to 3 rendered in a row.
 */
export default function AnthropicFeatureGridCream({ content, style }) {
  const frame = useCurrentFrame();
  const { title, description, items = [] } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  const headingFont = style.font?.heading ?? "serif";
  const bodyFont = style.font?.body ?? "Inter, sans-serif";

  const cards = items.map((raw) => {
    if (typeof raw === "string") return { head: raw, body: "" };
    if (Array.isArray(raw)) return { head: String(raw[0] ?? ""), body: String(raw[1] ?? "") };
    if (raw && typeof raw === "object") return { head: String(raw.head ?? raw.title ?? ""), body: String(raw.body ?? raw.description ?? "") };
    return { head: String(raw), body: "" };
  });

  return (
    <AbsoluteFill
      style={{
        background: palette.background ?? "#faf9f5",
        color: palette.foreground ?? "#141413",
        fontFamily: bodyFont,
        padding: "100px 86px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      {title && (
        <h1
          style={{
            fontFamily: headingFont,
            fontSize: 56 * scale,
            fontWeight: 400,
            lineHeight: 1.1,
            letterSpacing: "-0.5px",
            margin: 0,
            marginBottom: 18,
            opacity: interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          {title}
        </h1>
      )}
      {description && (
        <p
          style={{
            fontFamily: bodyFont,
            fontSize: 26,
            lineHeight: 1.5,
            margin: 0,
            marginBottom: 44,
            maxWidth: 900,
            color: palette.muted ?? "#6c6a64",
            opacity: interpolate(frame - 6, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          {description}
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.min(3, Math.max(1, cards.length))}, 1fr)`,
          gap: 28,
        }}
      >
        {cards.map((c, i) => {
          const delay = 10 + i * 7;
          const op = interpolate(frame - delay, [0, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const y = interpolate(frame - delay, [0, 16], [28, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div
              key={i}
              style={{
                opacity: op,
                transform: `translateY(${y}px)`,
                background: palette.primary ?? "#efe9de",
                color: palette.foreground ?? "#141413",
                borderRadius: 12,
                padding: 32,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 4,
                  background: palette.accent ?? "#cc785c",
                  borderRadius: 2,
                }}
              />
              <h2
                style={{
                  fontFamily: headingFont,
                  fontSize: 30 * scale,
                  fontWeight: 400,
                  lineHeight: 1.2,
                  margin: 0,
                  letterSpacing: "-0.3px",
                }}
              >
                {c.head}
              </h2>
              {c.body && (
                <p style={{ fontSize: 22, lineHeight: 1.5, margin: 0, color: palette.muted ?? "#6c6a64" }}>
                  {c.body}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
