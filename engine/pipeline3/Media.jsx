import React from "react";
import { Img, OffthreadVideo, staticFile } from "remotion";
import { isStaticMedia } from "../pipeline2/mediaShared.js";

/**
 * Single render-side helper for the three media shapes templates render:
 *
 *  - <img>      for plain remote URLs (Keeps current behaviour for http(s) urls)
 *  - <Img>      for remote still images that should block their own frame
 *               via Remotion's delayRender (so the frame doesn't paint
 *               before the bitmap has decoded — the stock <img> approach
 *               blanks the first few frames when the URL fetch is slow).
 *  - <Img src={staticFile(url)}> for images staged into public/media/ by
 *               pipeline 2's resolveMediaContent (entry.isStatic === true).
 *  - <OffthreadVideo src=...> for video sources, routed through
 *               Remotion's offthread extractor so headless chromium can
 *               seek frames without GPU acceleration.
 *
 * Structures call `<Media src={entry} ... />` and don't need to know whether
 * the url was a local path on the storyboard author's disk or a remote URL
 * — pipeline 2 already set `isStatic` on the resolved entry and this
 * component branches on it through isStaticMedia().
 *
 * Accepts the resolved ContentImage {@link isStaticMedia} shape OR a bare
 * string url (treated as remote). Extra props spread onto the underlying
 * Remotion element, so `style`, `alt`, `muted`, etc. all flow through.
 *
 * @param {Object} props
 * @param {{ url?: string, alt?: string, isStatic?: boolean } | string} [props.src]
 *        Resolved media entry from pipeline 2 (or a bare url string).
 * @param {"image"|"video"} [props.kind] - "image" (default) renders <Img>;
 *        "video" renders <OffthreadVideo>.
 * @param {React.CSSProperties} [props.style]
 */
export function Media({ src, kind = "image", alt, ...rest }) {
  if (!src) return null;
  const isStatic = isStaticMedia(src);
  const url = typeof src === "string" ? src : src.url;
  if (!url) return null;
  const resolvedAlt = alt ?? (typeof src === "object" && src ? src.alt : undefined);
  const finalSrc = isStatic ? staticFile(url) : url;

  if (kind === "video") {
    return <OffthreadVideo src={finalSrc} {...rest} />;
  }
  return <Img src={finalSrc} alt={resolvedAlt ?? ""} {...rest} />;
}

export default Media;
