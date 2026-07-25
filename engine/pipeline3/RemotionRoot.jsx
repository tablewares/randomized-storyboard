import React from "react";
import { Composition, getInputProps, registerRoot } from "remotion";
import { StoryboardVideo } from "./StoryboardVideo.jsx";

/**
 * Remotion loads this file as its entry point. The actual RenderInput is
 * passed in as inputProps at render time (see render.js), so this file just
 * wires up a single dynamically-sized composition.
 */
export const RemotionRoot = () => {
  const input = getInputProps().renderInput;

  return (
    <Composition
      id="StoryboardVideo"
      component={StoryboardVideo}
      fps={input.fps}
      width={1080}
      height={1920}
      durationInFrames={Math.max(1, Math.round(input.totalDurationSec * input.fps))}
      defaultProps={{ input }}
    />
  );
};

  /**
   * Remotion entry point. `hydratedScenes` and `totalDurationInFrames` are
   * passed in as input props at render time (see render.js), letting a single
   * generic composition render any scene list produced by pipelines 1 & 2.
   */

registerRoot(RemotionRoot);
