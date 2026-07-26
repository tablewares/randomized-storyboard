import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

/**
 * Anthropic pricing-tier-card grid (featured-dark variation).
 * Maps to DESIGN.md `pricing-tier-card-featured`:
 *   background flips to surface-dark (#181715), text inverts to on-dark.
 * The dark surface IS the featured-tier signal — no shadows.
 * Same stride-6 items layout as the cream variation.
 */
export default function AnthropicPricingDark({ content, style }) {
  const frame = useCurrentFrame();
  const { title, items = [], caption } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  const headingFont = style.font?.heading ?? "serif";
  const bodyFont = style.font?.body ?? "Inter, sans-serif";
  const { fps } = useVideoConfig();

  const tiers = [];
  const stride = 6;
  for (let i = 0; i < items.length; i += stride) {
    tiers.push({
      name: String(items[i] ?? ""),
      price: items[i + 1] !== undefined ? String(items[i + 1]) : "",
      feats: items.slice(i + 2, i + stride).map((f) => String(f ?? "")).filter(Boolean),
    });
  }

  // Middle tier is "featured" — make it surface-dark on a cream-canvas variant.
  const featuredIndex = tiers.length === 3 ? 1 : 0;

  return (
    <AbsoluteFill
      style={{
        background: palette.background ?? "#faf9f5",
        color: palette.foreground ?? "#141413",
        fontFamily: bodyFont,
        padding: "96px 80px",
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
            lineHeight: 1.1,
            letterSpacing: "-0.5px",
            margin: 0,
            marginBottom: 44,
            textAlign: "center",
            opacity: interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          {title}
        </h1>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.min(3, Math.max(1, tiers.length))}, 1fr)`,
          gap: 24,
          alignItems: "stretch",
        }}
      >
        {tiers.map((t, i) => {
          const delay = 8 + i * 6;
          const pop = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 110, mass: 0.7 } });
          const featured = i === featuredIndex;
          const bg = featured ? (palette.primary ?? "#181715") : (palette.background ?? "#faf9f5");
          const fg = featured ? (palette.foreground ?? "#faf9f5") : (palette.foreground ?? "#141413");
          const muted = featured ? (palette.muted ?? "#a09d96") : (palette.muted ?? "#6c6a64");
          return (
            <div
              key={i}
              style={{
                opacity: interpolate(frame - delay, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                transform: `scale(${0.96 + pop * 0.04})`,
                background: bg,
                color: fg,
                border: featured ? "none" : `1px solid ${palette.muted ?? "#e6dfd8"}`,
                borderRadius: 12,
                padding: 32,
                display: "flex",
                flexDirection: "column",
                position: "relative",
              }}
            >
              {featured && (
                <div
                  style={{
                    position: "absolute",
                    top: 18,
                    right: 18,
                    fontSize: 12,
                    fontWeight: 500,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    color: palette.accent ?? "#cc785c",
                  }}
                >
                  Featured
                </div>
              )}
              <div style={{ fontSize: 22, fontWeight: 500 }}>{t.name}</div>
              <div
                style={{
                  fontFamily: headingFont,
                  fontSize: 42 * scale,
                  fontWeight: 400,
                  letterSpacing: "-0.3px",
                  marginTop: 12,
                  marginBottom: 20,
                }}
              >
                {t.price}
              </div>
              <div style={{ height: 1, background: muted, opacity: 0.5, marginBottom: 18 }} />
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  fontSize: 20,
                  lineHeight: 1.5,
                }}
              >
                {t.feats.map((f, k) => {
                  const fop = interpolate(frame - delay - 6 - k * 3, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
                  return (
                    <li key={k} style={{ opacity: fop, display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{ color: palette.accent ?? "#cc785c" }}>·</span>
                      <span>{f}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {caption && (
        <p
          style={{
            margin: 0,
            marginTop: 36,
            fontSize: 20,
            color: palette.muted ?? "#6c6a64",
            textAlign: "center",
            opacity: interpolate(frame - (8 + tiers.length * 6 + 6), [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          {caption}
        </p>
      )}
    </AbsoluteFill>
  );
}
