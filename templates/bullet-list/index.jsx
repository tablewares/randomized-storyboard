import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";

/**
 * Bullet List template.
 * Expects a fully hydrated layout payload (see pipeline2/templating.js):
 *   { text, boundingBoxes: { title?, items }, style, assets, durationInFrames, content: { title?, ... } }
 * 
 * The text field should contain newline-separated bullet points.
 * e.g. "• First point\n• Second point\n• Third point"
 */
export default function BulletListTemplate({ layout }) {
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

  const iconAsset = assets.icon;
  const iconUrl = iconAsset?.url
    ? iconAsset.source === "local"
      ? staticFile(iconAsset.url)
      : iconAsset.url
    : null;

  // Parse bullet points from text (split by newlines)
  const bullets = text
    ? text.split("\n").filter(line => line.trim().length > 0)
    : [];

  // Get title from dynamic content if provided
  const title = content?.title;

  return (
    <AbsoluteFill style={{ backgroundColor: style.colors?.background || "#141414" }}>
      {backgroundUrl && (
        <Img
          src={backgroundUrl}
          style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.15 }}
        />
      )}

      {/* Title - if title region exists in boundingBoxes AND we have a title */}
      {boundingBoxes.title && title && (
        <div
          style={{
            position: "absolute",
            left: boundingBoxes.title.x,
            top: boundingBoxes.title.y,
            width: boundingBoxes.title.w,
            height: boundingBoxes.title.h,
            fontFamily: style.fontFamily,
            fontSize: 48,
            fontWeight: 700,
            lineHeight: 1.2,
            color: style.colors?.title,
            opacity: Math.min(opacity, fadeOutOpacity),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          {title}
        </div>
      )}

      {/* Bullet items */}
      {boundingBoxes.items && bullets.length > 0 && (
        <div
          style={{
            position: "absolute",
            left: boundingBoxes.items.x,
            top: boundingBoxes.items.y,
            width: boundingBoxes.items.w,
            height: boundingBoxes.items.h,
            fontFamily: style.fontFamily,
            fontSize: 28,
            lineHeight: 1.8,
            color: style.colors?.text,
            opacity: Math.min(opacity, fadeOutOpacity),
            overflow: "hidden",
          }}
        >
          {bullets.map((bullet, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 16,
                marginBottom: 24,
                paddingLeft: 40,
              }}
            >
              {/* Bullet/Icon */}
              {iconUrl ? (
                <Img
                  src={iconUrl}
                  style={{
                    width: 24,
                    height: 24,
                    flexShrink: 0,
                    marginTop: 4,
                    color: style.colors?.bullet,
                  }}
                />
              ) : (
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    backgroundColor: style.colors?.bullet,
                    flexShrink: 0,
                    marginTop: 8,
                  }}
                />
              )}
              <span style={{ flex: 1 }}>{bullet.replace(/^[\u2022\-\*]\s*/, "")}</span>
            </div>
          ))}
        </div>
      )}
    </AbsoluteFill>
  );
}
