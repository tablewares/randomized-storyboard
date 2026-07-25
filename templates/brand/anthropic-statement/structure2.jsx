import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

export default function AnthropicStatementStat({ content, style }) {
  const frame = useCurrentFrame();
  const { title, subtitle } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;

  const fade = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const rise = interpolate(frame, [0, 20], [30, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: palette.background ?? "#D97757",
        color: palette.foreground ?? "#F0EEE6",
        fontFamily: style.font?.body ?? "sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "160px 90px",
      }}
    >
      <h1
        style={{
          fontFamily: style.font?.heading ?? "serif",
          fontSize: 96 * scale,
          margin: 0,
          fontWeight: 400,
          opacity: fade,
          transform: `translateY(${rise}px)`,
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <p
          style={{
            fontSize: 32,
            marginTop: 28,
            opacity: fade,
            maxWidth: 760,
            color: palette.muted ?? "#F3E3D3",
          }}
        >
          {subtitle}
        </p>
      )}
    </AbsoluteFill>
  );
}