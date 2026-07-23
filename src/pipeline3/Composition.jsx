import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import SceneRenderer from "./SceneRenderer.jsx";

/**
 * Top-level video composition. Feeds each hydrated scene's exact
 * startFrame/durationInFrames (produced by pipeline 1, integer frame
 * counts) into a Remotion <Sequence>, and delegates rendering of the
 * matched/hydrated template to SceneRenderer.
 *
 * @param {{ hydratedScenes: Array<Object> }} props
 */
export default function VideoComposition({ hydratedScenes }) {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      {hydratedScenes.map((scene) => (
        <Sequence
          key={scene.sceneId}
          from={scene.startFrame}
          durationInFrames={scene.durationInFrames}
          name={`${scene.sceneIndex}-${scene.templateKey}`}
        >
          <SceneRenderer hydratedScene={scene} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
