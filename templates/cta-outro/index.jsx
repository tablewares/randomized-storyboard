import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

/**
 * <CtaOutro> Template — Anthropic style
 * Closing call-to-action / outro screen: optional wordmark, headline, supporting
 * line, and a small pill/chip (e.g. "Learn more").
 * Receives a fully hydrated layout payload from pipeline2/templating.js:
 *   {
 *     text: string,       // headline, e.g. "Try it yourself"
 *     subtitle?: string,  // supporting line, e.g. a URL or short prompt
 *     boundingBoxes: { logo, headline, subtext, chip },
 *     style: { colors: {...}, fontFamily: "..." },
 *     assets: { logo?: { url, source } },
 *     durationInFrames: number
 *   }
 */
export default function CtaOutro({ layout }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { boundingBoxes, style, assets, text, subtitle, durationInFrames } = layout;

  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const fadeOutStart = Math.max(durationInFrames - 15, 0);
  const fadeOutOpacity = interpolate(frame, [fadeOutStart, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const finalOpacity = Math.min(opacity, fadeOutOpacity);

  // Chip rises in slightly after the headline, with a soft spring
  const chipPop = spring({ frame: frame - 8, fps, config: { damping: 16, stiffness: 140, mass: 0.6 } });
  const chipTranslateY = interpolate(chipPop, [0, 1], [16, 0], { extrapolateLeft: "clamp" });
  const chipOpacity = Math.min(finalOpacity, interpolate(chipPop, [0, 1], [0, 1], { extrapolateLeft: "clamp" }));

  const logo = assets?.logo;
  const logoUrl = logo?.url ? (logo.source === "local" ? staticFile(logo.url) : logo.url) : null;

  return (
    <AbsoluteFill style={{ backgroundColor: style.colors?.background || "#F5F1EB" }}>
      {logoUrl && (
        <div
          style={{
            position: "absolute",
            left: boundingBoxes.logo.x,
            top: boundingBoxes.logo.y,
            width: boundingBoxes.logo.w,
            height: boundingBoxes.logo.h,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: finalOpacity,
          }}
        >
          <Img src={logoUrl} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
        </div>
      )}

      {/* Headline */}
      <div
        style={{
          position: "absolute",
          left: boundingBoxes.headline.x,
          top: boundingBoxes.headline.y,
          width: boundingBoxes.headline.w,
          height: boundingBoxes.headline.h,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          fontFamily: style.fontFamily,
          fontSize: 84,
          fontWeight: 500,
          lineHeight: 1.15,
          color: style.colors?.headline || "#1F1B16",
          textShadow: `0 6px 24px ${style.colors?.shadow || "rgba(31,27,22,0.12)"}`,
          opacity: finalOpacity,
        }}
      >
        {text}
      </div>

      {/* Supporting line */}
      {subtitle && (
        <div
          style={{
            position: "absolute",
            left: boundingBoxes.subtext.x,
            top: boundingBoxes.subtext.y,
            width: boundingBoxes.subtext.w,
            height: boundingBoxes.subtext.h,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            fontFamily: "'Styrene A', 'Helvetica Neue', Arial, sans-serif",
            fontSize: 36,
            fontWeight: 400,
            lineHeight: 1.4,
            color: style.colors?.subtext || "#6C6A63",
            opacity: finalOpacity,
          }}
        >
          {subtitle}
        </div>
      )}

      {/* Chip / pill */}
      <div
        style={{
          position: "absolute",
          left: boundingBoxes.chip.x,
          top: boundingBoxes.chip.y,
          width: boundingBoxes.chip.w,
          height: boundingBoxes.chip.h,
          borderRadius: boundingBoxes.chip.h / 2,
          backgroundColor: style.colors?.chipBg || "#CC785C",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Styrene A', 'Helvetica Neue', Arial, sans-serif",
          fontSize: 32,
          fontWeight: 600,
          color: style.colors?.chipText || "#F5F1EB",
          opacity: chipOpacity,
          transform: `translateY(${chipTranslateY}px)`,
        }}
      >
        Learn more
      </div>
    </AbsoluteFill>
  );
}
