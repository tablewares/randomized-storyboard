import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

/**
 * Anthropic cta-band-dark (dark variation).
 * Maps to DESIGN.md `cta-band-dark`:
 *   surface-dark fill, on-dark text, display-sm serif headline.
 * Pairs coral-accented label with a cream "Try Claude" text-link affordance.
 */
export default function AnthropicCtaDark({ content, style }) {
  const frame = useCurrentFrame();
  const { title, subtitle, description, label } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  const headingFont = style.font?.heading ?? "serif";
  const bodyFont = style.font?.body ?? "Inter, sans-serif";

  const fade = (d) => interpolate(frame - d, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rise = (d) => interpolate(frame - d, [0, 18], [26, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: palette.background ?? "#181715",
        color: palette.foreground ?? "#faf9f5",
        fontFamily: bodyFont,
        padding: 96,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      {label && (
        <div
          style={{
            fontSize: 18,
            fontWeight: 500,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            marginBottom: 24,
            color: palette.accent ?? "#cc785c",
            opacity: fade(0),
          }}
        >
          {label}
        </div>
      )}
      <h1
        style={{
          fontFamily: headingFont,
          fontSize: 64 * scale,
          fontWeight: 400,
          lineHeight: 1.1,
          letterSpacing: "-0.5px",
          margin: 0,
          maxWidth: 1100,
          opacity: fade(4),
          transform: `translateY(${rise(4)}px)`,
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <p
          style={{
            fontFamily: bodyFont,
            fontSize: 28,
            lineHeight: 1.45,
            margin: 0,
            marginTop: 24,
            maxWidth: 880,
            color: palette.muted ?? "#a09d96",
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
            fontFamily: bodyFont,
            fontSize: 22,
            lineHeight: 1.5,
            margin: 0,
            marginTop: 18,
            maxWidth: 760,
            color: palette.muted ?? "#a09d96",
            opacity: fade(14),
          }}
        >
          {description}
        </p>
      )}
    </AbsoluteFill>
  );
}
