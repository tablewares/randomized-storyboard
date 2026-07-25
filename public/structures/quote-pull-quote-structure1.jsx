import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

/**
 * Quote template - displays a large quote with attribution
 */
export default function QuotePullQuote({ content, style }) {
  const frame = useCurrentFrame();
  const { quote, source, caption } = content;
  const palette = style.palette ?? {};

  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const translateY = interpolate(frame, [0, 15], [30, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: palette.background ?? "#0f0f12",
        color: palette.foreground ?? "#f5f5f7",
        padding: 80,
        fontFamily: style.font?.heading ?? "Georgia, serif",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <blockquote style={{ opacity, transform: `translateY(${translateY}px)`, margin: 0, maxWidth: 900 }}>
        <p style={{ fontSize: 48 * (style.font?.scale ?? 1), lineHeight: 1.3, fontStyle: "italic", margin: 0 }}>
          "{quote}"
        </p>
        {source && (
          <footer style={{ marginTop: 32, fontSize: 24, opacity: 0.8, fontStyle: "normal" }}>
            — {source}
          </footer>
        )}
        {caption && (
          <p style={{ marginTop: 16, fontSize: 20, opacity: 0.6, fontStyle: "normal" }}>
            {caption}
          </p>
        )}
      </blockquote>
      <div style={{ marginTop: 40, width: 80, height: 4, background: palette.accent ?? "#ff6b6b", borderRadius: 2 }} />
    </AbsoluteFill>
  );
}
