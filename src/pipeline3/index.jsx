import React from "react";
import { Composition, registerRoot } from "remotion";
import VideoComposition from "./Composition.jsx";
import { VIDEO_WIDTH, VIDEO_HEIGHT, FPS } from "../config.js";

/**
 * Remotion entry point. `hydratedScenes` and `totalDurationInFrames` are
 * passed in as input props at render time (see render.js), letting a single
 * generic composition render any scene list produced by pipelines 1 & 2.
 */
function RemotionRoot() {
  return (
    <Composition
      id="MainVideo"
      component={VideoComposition}
      fps={FPS}
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
      durationInFrames={30} // placeholder; overridden by calculateMetadata below
      defaultProps={{ hydratedScenes: [] }}
      calculateMetadata={async ({ props }) => ({
        durationInFrames: Math.max(props.totalDurationInFrames || 30, 1),
        fps: props.fps || FPS,
        width: props.width || VIDEO_WIDTH,
        height: props.height || VIDEO_HEIGHT,
      })}
    />
  );
}

registerRoot(RemotionRoot);
