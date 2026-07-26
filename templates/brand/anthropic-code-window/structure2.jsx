import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

/**
 * Anthropic code-window-card (terminal/REPL variation).
 * Renders a prompt-styled code block (">_" marker, monospace lines) on
 * surface-dark. The accent-teal prompt marker is the only non-cream glyph.
 */
export default function AnthropicCodeWindowTerminal({ content, style }) {
  const frame = useCurrentFrame();
  const { title, items = [], caption } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  const headingFont = style.font?.heading ?? "serif";
  const bodyFont = style.font?.body ?? "Inter, sans-serif";
  const codeFont = "JetBrains Mono, ui-monospace, monospace";

  const lines = items.map((it) => (typeof it === "string" ? it : String(it ?? "")));

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
            marginBottom: 30,
            opacity: interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          {title}
        </h1>
      )}

      <div
        style={{
          background: "#1f1e1b",
          borderRadius: 12,
          padding: 28,
          fontFamily: codeFont,
          fontSize: 24,
          lineHeight: 1.6,
          opacity: interpolate(frame - 8, [0, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        <div style={{ marginBottom: 16, fontSize: 18, letterSpacing: 1, textTransform: "uppercase", color: palette.accent ?? "#cc785c" }}>
          Terminal
        </div>
        {lines.map((line, i) => {
          const delay = 12 + i * 4;
          const op = interpolate(frame - delay, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={i} style={{ opacity: op, display: "flex", gap: 14 }}>
              <span style={{ color: "#5db8a6" }}>{">"}</span>
              <span style={{ whiteSpace: "pre", color: palette.foreground ?? "#faf9f5" }}>{line}</span>
            </div>
          );
        })}
        <div
          style={{
            marginTop: 16,
            opacity: interpolate(frame - (12 + lines.length * 4 + 2), [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            color: "#5db8a6",
          }}
        >
          {">"}_
        </div>
      </div>

      {caption && (
        <p
          style={{
            marginTop: 24,
            fontSize: 20,
            color: palette.muted ?? "#a09d96",
            margin: 0,
            opacity: interpolate(frame - (12 + lines.length * 4 + 8), [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          {caption}
        </p>
      )}
    </AbsoluteFill>
  );
}
