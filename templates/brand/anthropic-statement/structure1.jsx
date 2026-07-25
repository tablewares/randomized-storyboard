import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

export default function AnthropicStatementDefault({ content, style }) {
  const frame = useCurrentFrame();
  const { title, subtitle, description, source } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;

  const rise = (delay) =>
    interpolate(frame - delay, [0, 18], [24, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fade = (delay) =>
    interpolate(frame - delay, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: palette.background ?? "#F0EEE6",
        color: palette.foreground ?? "#1F1E1D",
        fontFamily: style.font?.body ?? "sans-serif",
        padding: "160px 90px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 56,
          height: 6,
          background: palette.accent ?? "#D97757",
          marginBottom: 40,
          opacity: fade(0),
        }}
      />

      <h1
        style={{
          fontFamily: style.font?.heading ?? "serif",
          fontSize: 58 * scale,
          lineHeight: 1.15,
          margin: 0,
          fontWeight: 400,
          opacity: fade(4),
          transform: `translateY(${rise(4)}px)`,
        }}
      >
        {title}
      </h1>

      {subtitle && (
        <p
          style={{
            fontSize: 30 * scale,
            marginTop: 24,
            color: palette.accent ?? "#D97757",
            opacity: fade(10),
            transform: `translateY(${rise(10)}px)`,
          }}
        >
          {subtitle}
        </p>
      )}

      {description && (
        <p
          style={{
            fontSize: 26,
            lineHeight: 1.5,
            marginTop: 32,
            maxWidth: 820,
            color: palette.muted ?? "#8A8677",
            opacity: fade(16),
            transform: `translateY(${rise(16)}px)`,
          }}
        >
          {description}
        </p>
      )}

      {source && (
        <p
          style={{
            fontSize: 20,
            marginTop: 48,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: palette.muted ?? "#8A8677",
            opacity: fade(22),
          }}
        >
          {source}
        </p>
      )}
    </AbsoluteFill>
  );
}