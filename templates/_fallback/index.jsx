import React from "react";
import { AbsoluteFill } from "remotion";

/**
 * Primitive fallback template. Used when a scene scores below THRESHOLD
 * against both template roots. Deliberately dependency-free: plain text
 * on a flat background, no remote/local assets, so it can never fail to
 * resolve during rendering.
 */
export default function FallbackTemplate({ layout }) {
  const { boundingBoxes, style, text } = layout;

  return (
    <AbsoluteFill style={{ backgroundColor: style.colors?.background }}>
      <div
        style={{
          position: "absolute",
          left: boundingBoxes.text.x,
          top: boundingBoxes.text.y,
          width: boundingBoxes.text.w,
          height: boundingBoxes.text.h,
          fontFamily: style.fontFamily,
          fontSize: 40,
          color: style.colors?.text,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
}
