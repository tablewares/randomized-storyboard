import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

/**
 * <StatHighlight> Template — Anthropic style
 * Big number/stat callout with an eyebrow label and supporting caption.
 * Receives a fully hydrated layout payload from pipeline2/templating.js:
 *   {
 *     text: string,       // the stat itself, e.g. "10x" or "92%"
 *     subtitle?: string,  // supporting caption under the stat
 *     boundingBoxes: { eyebrow, stat, label },
 *     style: { colors: {...}, fontFamily: "..." },
 *     assets: { background?: { url, source } },
 *     durationInFrames: number
 *   }
 */
export default function StatHighlight({ layout }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { boundingBoxes, style, assets, text, subtitle, durationInFrames } = layout;

  // Fade in/out
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const fadeOutStart = Math.max(durationInFrames - 15, 0);
  const fadeOutOpacity = interpolate(frame, [fadeOutStart, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const finalOpacity = Math.min(opacity, fadeOutOpacity);

  // Stat "counts up" into place with a soft spring pop
  const pop = spring({ frame, fps, config: { damping: 14, stiffness: 120, mass: 0.6 } });
  const statScale = interpolate(pop, [0, 1], [0.85, 1]);

  const bg = assets?.background;
  const bgUrl = bg?.url ? (bg.source === "local" ? staticFile(bg.url) : bg.url) : null;

  return (
    <AbsoluteFill style={{ backgroundColor: style.colors?.background || "#F5F1EB" }}>
      {bgUrl && (
        <Img
          src={bgUrl}
          style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.15, position: "absolute" }}
        />
      )}

      {/* Eyebrow */}
      <div
        style={{
          position: "absolute",
          left: boundingBoxes.eyebrow.x,
          top: boundingBoxes.eyebrow.y,
          width: boundingBoxes.eyebrow.w,
          height: boundingBoxes.eyebrow.h,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Styrene A', 'Helvetica Neue', Arial, sans-serif",
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: style.colors?.eyebrow || "#CC785C",
          opacity: finalOpacity,
        }}
      >
        By the numbers
      </div>

      {/* Stat */}
      <div
        style={{
          position: "absolute",
          left: boundingBoxes.stat.x,
          top: boundingBoxes.stat.y,
          width: boundingBoxes.stat.w,
          height: boundingBoxes.stat.h,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: style.fontFamily,
          fontSize: 220,
          fontWeight: 500,
          lineHeight: 1,
          color: style.colors?.stat || "#1F1B16",
          textShadow: `0 8px 32px ${style.colors?.shadow || "rgba(31,27,22,0.12)"}`,
          opacity: finalOpacity,
          transform: `scale(${statScale})`,
        }}
      >
        {text}
      </div>

      {/* Rule */}
      <div
        style={{
          position: "absolute",
          left: boundingBoxes.label.x,
          top: boundingBoxes.label.y - 30,
          width: 80,
          height: 3,
          backgroundColor: style.colors?.rule || "#D9D3C7",
          opacity: finalOpacity,
        }}
      />

      {/* Label / caption */}
      {subtitle && (
        <div
          style={{
            position: "absolute",
            left: boundingBoxes.label.x,
            top: boundingBoxes.label.y,
            width: boundingBoxes.label.w,
            height: boundingBoxes.label.h,
            fontFamily: "'Styrene A', 'Helvetica Neue', Arial, sans-serif",
            fontSize: 40,
            fontWeight: 400,
            lineHeight: 1.35,
            color: style.colors?.label || "#6C6A63",
            opacity: finalOpacity,
          }}
        >
          {subtitle}
        </div>
      )}
    </AbsoluteFill>
  );
}
