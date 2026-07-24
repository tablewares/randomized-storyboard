import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";

/**
 * Quote template.
 * Expects a fully hydrated layout payload (see pipeline2/templating.js):
 *   { text, boundingBoxes: { quoteText, attribution }, style, assets, durationInFrames, content: { attribution?, ... } }
 */
export default function QuoteTemplate({ layout }) {
  const frame = useCurrentFrame();
  const { boundingBoxes, style, assets, text, durationInFrames, content } = layout;

  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const fadeOutStart = Math.max(durationInFrames - 15, 0);
  const fadeOutOpacity = interpolate(frame, [fadeOutStart, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const backgroundAsset = assets.background;
  const backgroundUrl = backgroundAsset?.url
    ? backgroundAsset.source === "local"
      ? staticFile(backgroundAsset.url)
      : backgroundAsset.url
    : null;

  // Get attribution from dynamic content (or fallback to layout.attribution for backwards compat)
  const attribution = content?.attribution ?? layout.attribution;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {backgroundUrl && (
        <Img
          src={backgroundUrl}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}
      <AbsoluteFill style={{ backgroundColor: style.colors?.overlay }} />

      <div
        style={{
          position: "absolute",
          left: boundingBoxes.quoteText.x,
          top: boundingBoxes.quoteText.y,
          width: boundingBoxes.quoteText.w,
          height: boundingBoxes.quoteText.h,
          fontFamily: style.fontFamily,
          fontSize: 56,
          lineHeight: 1.25,
          color: style.colors?.text,
          opacity: Math.min(opacity, fadeOutOpacity),
        }}
      >
        “{text}”
      </div>

      {attribution && boundingBoxes.attribution && (
        <div
          style={{
            position: "absolute",
            left: boundingBoxes.attribution.x,
            top: boundingBoxes.attribution.y,
            width: boundingBoxes.attribution.w,
            height: boundingBoxes.attribution.h,
            fontFamily: style.fontFamily,
            fontSize: 28,
            color: style.colors?.attribution,
            opacity: Math.min(opacity, fadeOutOpacity),
          }}
        >
          — {attribution}
        </div>
      )}
    </AbsoluteFill>
  );
}
