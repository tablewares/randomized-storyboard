import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

/**
 * Anthropic callout-card-coral (default variation).
 * Maps to DESIGN.md `callout-card-coral` / `cta-band-coral`:
 *   full-bleed coral fill (colors.primary #cc785c), on-primary text,
 *   display-sm serif headline, a sub-line, and a cream/canvas button pill.
 * The coral surface IS the voltage — no shadows.
 */
export default function AnthropicCtaCoral({ content, style }) {
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
        background: palette.background ?? "#cc785c",
        color: palette.foreground ?? "#ffffff",
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
            fontSize: 20,
            fontWeight: 500,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            marginBottom: 24,
            padding: "6px 16px",
            border: `1.5px solid ${palette.foreground ?? "#ffffff"}`,
            borderRadius: 9999,
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
            opacity: fade(14),
          }}
        >
          {description}
        </p>
      )}
    </AbsoluteFill>
  );
}
