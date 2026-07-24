import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";

/**
 * Title Card template.
 * Expects a fully hydrated layout payload (see pipeline2/templating.js):
 *   { text, subtitle?, boundingBoxes: { title, subtitle? }, style, assets, durationInFrames }
 */
export default function TitleCardTemplate({ layout, subtitle }) {
  const frame = useCurrentFrame();
  const { boundingBoxes, style, assets, text, durationInFrames } = layout;

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
          left: boundingBoxes.title.x,
          top: boundingBoxes.title.y,
          width: boundingBoxes.title.w,
          height: boundingBoxes.title.h,
          fontFamily: style.fontFamily,
          fontSize: 72,
          fontWeight: 800,
          lineHeight: 1.1,
          color: style.colors?.title,
          textShadow: `0 4px 24px ${style.colors?.shadow || "rgba(0,0,0,0.8)"}`,
          opacity: Math.min(opacity, fadeOutOpacity),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        {text}
      </div>

      {subtitle && boundingBoxes.subtitle && (
        <div
          style={{
            position: "absolute",
            left: boundingBoxes.subtitle.x,
            top: boundingBoxes.subtitle.y,
            width: boundingBoxes.subtitle.w,
            height: boundingBoxes.subtitle.h,
            fontFamily: style.fontFamily,
            fontSize: 32,
            fontWeight: 400,
            lineHeight: 1.3,
            color: style.colors?.subtitle,
            textShadow: `0 2px 12px ${style.colors?.shadow || "rgba(0,0,0,0.6)"}`,
            opacity: Math.min(opacity, fadeOutOpacity),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          {subtitle}
        </div>
      )}
    </AbsoluteFill>
  );
}
