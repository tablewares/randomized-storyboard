import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

/**
 * Anthropic code-window-card (default variation).
 * Maps to DESIGN.md `code-window-card`:
 *   background = surface-dark (#181715), inner code block = surface-dark-soft (#1f1e1b),
 *   JetBrains Mono code at 14px / 1.6, rounded 12px, padding 24px.
 * Renders a mock code editor: a small title strip (traffic-light dots optional),
 * line numbers in muted-soft, then code lines from content.items.
 * content.items entries may be plain strings (rendered as-is).
 */
export default function AnthropicCodeWindow({ content, style }) {
  const frame = useCurrentFrame();
  const { title, description, items = [], caption } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  const headingFont = style.font?.heading ?? "serif";
  const bodyFont = style.font?.body ?? "Inter, sans-serif";
  const codeFont = "JetBrains Mono, ui-monospace, monospace";

  const lines = items.map((it) => (typeof it === "string" ? it : String(it ?? "")));
  const pad = String(lines.length).length;

  return (
    <AbsoluteFill
      style={{
        background: palette.background ?? "#181715",
        color: palette.foreground ?? "#faf9f5",
        fontFamily: bodyFont,
        padding: "110px 90px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      {title && (
        <h1
          style={{
            fontFamily: headingFont,
            fontSize: 50 * scale,
            fontWeight: 400,
            lineHeight: 1.15,
            letterSpacing: "-0.5px",
            margin: 0,
            marginBottom: 14,
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
            fontSize: 24,
            lineHeight: 1.5,
            margin: 0,
            marginBottom: 36,
            maxWidth: 900,
            color: palette.muted ?? "#a09d96",
            opacity: interpolate(frame - 6, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          {description}
        </p>
      )}

      <div
        style={{
          background: palette.primary ?? "#1f1e1b",
          borderRadius: 12,
          padding: 24,
          opacity: interpolate(frame - 10, [0, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          <span style={{ width: 11, height: 11, borderRadius: 9999, background: "#c64545", display: "inline-block" }} />
          <span style={{ width: 11, height: 11, borderRadius: 9999, background: "#d4a017", display: "inline-block" }} />
          <span style={{ width: 11, height: 11, borderRadius: 9999, background: "#5db872", display: "inline-block" }} />
        </div>
        <div style={{ fontFamily: codeFont, fontSize: 22, lineHeight: 1.6 }}>
          {lines.map((line, i) => {
            const delay = 14 + i * 3;
            const op = interpolate(frame - delay, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <div
                key={i}
                style={{
                  opacity: op,
                  display: "flex",
                  gap: 20,
                }}
              >
                <span
                  style={{
                    color: palette.muted ?? "#a09d96",
                    textAlign: "right",
                    width: pad * 18,
                    userSelect: "none",
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ whiteSpace: "pre", color: palette.foreground ?? "#faf9f5" }}>
                  {line}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {caption && (
        <p
          style={{
            marginTop: 28,
            fontSize: 20,
            color: palette.muted ?? "#a09d96",
            margin: 0,
            paddingTop: 28,
            opacity: interpolate(frame - (14 + lines.length * 3 + 4), [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          {caption}
        </p>
      )}
    </AbsoluteFill>
  );
}
