import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { Media } from "../../../engine/pipeline3/Media.jsx";
/** Single hero image that slowly zooms (Ken Burns). */
export default function GallerySingleZoom({ content, style }) {
  const frame = useCurrentFrame();
  const { image, title, caption } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  const z = interpolate(frame, [0, 120], [1, 1.12], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: palette.background ?? "#0b0b12", color: palette.foreground ?? "#fff", fontFamily: style.font?.heading ?? "Inter, sans-serif" }}>
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <Media src={image} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${z})` }} />
        <AbsoluteFill style={{ background: "linear-gradient(to top, rgba(0,0,0,0.65), transparent 55%)" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "flex-end", padding: 80, flexDirection: "column" }}>
        {title && <h1 style={{ fontSize: 56 * scale, margin: 0, fontWeight: 800 }}>{title}</h1>}
        {caption && <p style={{ fontSize: 22, marginTop: 14, opacity: 0.85, maxWidth: 800 }}>{caption}</p>}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
