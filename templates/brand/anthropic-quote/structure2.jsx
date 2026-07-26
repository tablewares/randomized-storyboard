import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

/**
 * Anthropic pull-quote (dark-navy editorial variation).
 * Dark surface (#181715), cream-tinted on-dark text, coral accent rule
 * and signature oversized opening mark. The cream-to-dark surface contrast
 * is the brand's pacing rhythm — this variation deliberately inverts the
 * cream-canvas quote.
 */
export default function AnthropicQuoteDark({ content, style }) {
  const frame = useCurrentFrame();
  const { quote, author, source, caption } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  const headingFont = style.font?.heading ?? "serif";
  const bodyFont = style.font?.body ?? "Inter, sans-serif";

  const fade = (d) => interpolate(frame - d, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rise = (d) => interpolate(frame - d, [0, 18], [22, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: palette.background ?? "#181715",
        color: palette.foreground ?? "#faf9f5",
        fontFamily: headingFont,
        padding: "140px 96px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: 64,
          height: 5,
          background: palette.accent ?? "#cc785c",
          borderRadius: 3,
          marginBottom: 36,
          opacity: fade(0),
        }}
      />
      <div
        style={{
          fontFamily: headingFont,
          fontSize: 160 * scale,
          lineHeight: 0.6,
          color: palette.accent ?? "#cc785c",
          marginBottom: 4,
          opacity: fade(2),
        }}
      >
        “
      </div>
      <blockquote
        style={{
          margin: 0,
          fontFamily: headingFont,
          fontSize: 44 * scale,
          fontWeight: 400,
          lineHeight: 1.25,
          letterSpacing: "-0.4px",
          maxWidth: 1100,
          opacity: fade(6),
          transform: `translateY(${rise(6)}px)`,
        }}
      >
        {quote}
      </blockquote>
      {(author || source) && (
        <div
          style={{
            marginTop: 32,
            fontFamily: bodyFont,
            fontSize: 16,
            fontWeight: 500,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: palette.muted ?? "#a09d96",
            opacity: fade(14),
            transform: `translateY(${rise(14)}px)`,
            display: "flex",
            gap: 12,
            alignItems: "center",
          }}
        >
          {author && <span>{author}</span>}
          {author && source && <span style={{ color: palette.accent ?? "#cc785c" }}>·</span>}
          {source && <span>{source}</span>}
        </div>
      )}
      {caption && (
        <p
          style={{
            marginTop: 26,
            fontFamily: bodyFont,
            fontSize: 22,
            lineHeight: 1.5,
            maxWidth: 760,
            color: palette.muted ?? "#a09d96",
            margin: 0,
            marginTop: 26,
            opacity: fade(18),
          }}
        >
          {caption}
        </p>
      )}
    </AbsoluteFill>
  );
}
