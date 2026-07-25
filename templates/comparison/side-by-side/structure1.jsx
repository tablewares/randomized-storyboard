import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
/** Side-by-side comparison: two columns A vs B using items grouped in pairs, or images. */
export default function CompareSideBySide({ content, style }) {
  const frame = useCurrentFrame();
  const { title, subtitle, items = [], images = [], caption } = content;
  const palette = style.palette ?? {};
  const scale = style.font?.scale ?? 1;
  // Left label/value = first two items; right = next two. Or images[0]/[1].
  const left = { head: items[0] ?? "A", body: items[1] ?? "" };
  const right = { head: items[2] ?? "B", body: items[3] ?? "" };
  const opL = interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const opR = interpolate(frame, [10, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const Side = ({ side, align }) => (
    <div style={{ flex: 1, opacity: side === "l" ? opL : opR, display: "flex", flexDirection: "column", alignItems: align }}>
      {images.length > 0 && images[side === "l" ? 0 : 1] && (
        <div style={{ width: 360, height: 220, borderRadius: 14, marginBottom: 24, overflow: "hidden", background: palette.muted ?? "#222" }}>
          {(() => { const im = images[side === "l" ? 0 : 1]; return im?.url ? <img src={im.url} alt={im.alt ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null; })()}
        </div>
      )}
      <div style={{ fontSize: 56 * scale, fontWeight: 800, color: side === "l" ? palette.accent : palette.primary }}>{side.head}</div>
      {side.body && <div style={{ fontSize: 26, marginTop: 14, opacity: 0.85, maxWidth: 460, textAlign: align === "center" ? "center" : "left" }}>{side.body}</div>}
    </div>
  );
  return (
    <AbsoluteFill style={{ background: palette.background ?? "#0b0b12", color: palette.foreground ?? "#fff", padding: 80, fontFamily: style.font?.heading ?? "Inter, sans-serif", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      {title && <h1 style={{ fontSize: 56 * scale, margin: 0, marginBottom: 32, textAlign: "center", fontWeight: 800 }}>{title}</h1>}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, position: "relative" }}>
        <Side side={left} align="l" />
        <div style={{ fontSize: 48, fontWeight: 800, color: palette.accent, opacity: interpolate(frame, [16, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>vs</div>
        <Side side={right} align="r" />
      </div>
      {subtitle && <div style={{ marginTop: 32, fontSize: 24, opacity: 0.7, textAlign: "center" }}>{subtitle}</div>}
      {caption && <div style={{ marginTop: 16, fontSize: 20, opacity: 0.5, textAlign: "center" }}>{caption}</div>}
    </AbsoluteFill>
  );
}
