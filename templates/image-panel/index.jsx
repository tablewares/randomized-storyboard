import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, staticFile } from "remotion";

const VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm", ".m4v"];

function isVideoAsset(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Image-panel template.
 * Renders either <Img /> or <OffthreadVideo /> for the media slot depending
 * on the resolved asset's file extension, so both local and remote media
 * URLs never block or time out during renderMedia().
 * 
 * Expects a fully hydrated layout payload (see pipeline2/templating.js):
 *   { text, boundingBoxes: { media, caption }, style, assets, content: { ... } }
 */
export default function ImagePanelTemplate({ layout }) {
  const { boundingBoxes, style, assets, text, content } = layout;
  const mediaAsset = assets.media;
  const mediaUrl = mediaAsset?.url
    ? mediaAsset.source === "local"
      ? staticFile(mediaAsset.url)
      : mediaAsset.url
    : null;
  const isVideo = isVideoAsset(mediaAsset?.url);

  // Support additional dynamic content fields
  const caption = content?.caption ?? text;

  return (
    <AbsoluteFill style={{ backgroundColor: style.colors?.captionBg }}>
      <div
        style={{
          position: "absolute",
          left: boundingBoxes.media.x,
          top: boundingBoxes.media.y,
          width: boundingBoxes.media.w,
          height: boundingBoxes.media.h,
          overflow: "hidden",
        }}
      >
        {mediaUrl && (
          isVideo ? (
            <OffthreadVideo
              src={mediaUrl}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <Img
              src={mediaUrl}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          )
        )}
      </div>

      <div
        style={{
          position: "absolute",
          left: boundingBoxes.caption.x,
          top: boundingBoxes.caption.y,
          width: boundingBoxes.caption.w,
          height: boundingBoxes.caption.h,
          fontFamily: style.fontFamily,
          fontSize: 34,
          color: style.colors?.captionText,
        }}
      >
        {caption}
      </div>
    </AbsoluteFill>
  );
}
