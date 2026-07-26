import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

/**
 * Anthropic pricing-tier-card grid (cream variation).
 * Maps to DESIGN.md `pricing-tier-card`: canvas background, hairline border,
 * rounded 12px, padding 32px. Plan name in title-lg (StyreneB / Inter),
 * price in display-sm (Copernicus serif!), features list in body-md.
 *
 * items layout (flat array, paired):
 *   items[0]    = plan name (e.g. "Free")
 *   items[1]    = price string (e.g. "$20/mo")
 *   items[2..5] = up to 4 feature bullets
 *   items[6]    = next plan name, ...
 */
export default function AnthropicPricingCream({ content, style }) {
  const frame = useCurrentFrame();
  const { title, items = [], caption } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  const headingFont = style.font?.heading ?? "serif";
  const bodyFont = style.font?.body ?? "Inter, sans-serif";
  const { fps } = useVideoConfig();

  // Group flat items into 6-cell tiers: name, price, 4 features.
  const tiers = [];
  const stride = 6;
  for (let i = 0; i < items.length; i += stride) {
    tiers.push({
      name: String(items[i] ?? ""),
      price: items[i + 1] !== undefined ? String(items[i + 1]) : "",
      feats: items.slice(i + 2, i + stride).map((f) => String(f ?? "")).filter(Boolean),
    });
  }

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
        }}
      >
        {tiers.map((t, i) => {
          const delay = 8 + i * 6;
          const pop = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 110, mass: 0.7 } });
          return (
            <div
              key={i}
              style={{
                opacity: interpolate(frame - delay, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                transform: `scale(${0.96 + pop * 0.04})`,
                background: palette.background ?? "#faf9f5",
                color: palette.foreground ?? "#141413",
                border: `1px solid ${palette.muted ?? "#e6dfd8"}`,
                borderRadius: 12,
                padding: 32,
                display: "flex",
                flexDirection: "column",
              }}
            >
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
              <div style={{ height: 1, background: palette.muted ?? "#e6dfd8", marginBottom: 18 }} />
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
