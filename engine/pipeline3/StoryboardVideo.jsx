import React, { Suspense } from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";

// Statically import all structure components - Remotion can bundle these at build time
import ListBasicDefault from "./structure1.jsx";
import ListBasicBoldNumbered from "./structure2.jsx";

const TRANSITION_DURATION_FRAMES = 15;

// Map structure filenames to their components
// This allows dynamic selection at render time while keeping static imports for bundling
const STRUCTURE_COMPONENTS = {
  "structure1.jsx": ListBasicDefault,
  "structure2.jsx": ListBasicBoldNumbered,
};

function presentationForTransition(type) {
  switch (type) {
    case "fade":
      return fade();
    case "slide-left":
      return slide({ direction: "from-right" });
    case "slide-up":
      return slide({ direction: "from-bottom" });
    case "wipe":
      return wipe();
    case "zoom-blend":
      return fade();
    case "cut":
    default:
      return null;
  }
}

/**
 * @param {{ input: import("../../types.js").RenderInput }} props
 */
export const StoryboardVideo = ({ input }) => {
  const { fps, scenes, transitions, audioPath, music, sfx } = input;

  const sceneFrames = scenes.map((s) => ({
    scene: s,
    fromFrame: Math.round(s.timing.startSec * fps),
    durationInFrames: Math.max(1, Math.round((s.timing.endSec - s.timing.startSec) * fps)),
  }));

  const transitionByPair = new Map(transitions.map((t) => [`${t.betweenSceneId}->${t.andSceneId}`, t.type]));

  return (
    <AbsoluteFill>
      <TransitionSeries>
        {sceneFrames.map(({ scene, durationInFrames }, i) => {
          const prev = sceneFrames[i - 1]?.scene;
          const transitionType = prev ? transitionByPair.get(`${prev.sceneId}->${scene.sceneId}`) ?? "cut" : "cut";
          const presentation = presentationForTransition(transitionType);

          // Look up the structure component by filename
          const StructureComponent = STRUCTURE_COMPONENTS[scene.structurePath] ?? ListBasicDefault;

          const elements = [
            <TransitionSeries.Sequence key={`scene-${scene.sceneId}`} durationInFrames={durationInFrames}>
              <Suspense fallback={<AbsoluteFill style={{ background: scene.style.palette?.background ?? "#000" }} />}>
                <StructureComponent content={scene.content} style={scene.style} animation={scene.animation} />
              </Suspense>
            </TransitionSeries.Sequence>,
          ];

          if (presentation) {
            elements.unshift(
              <TransitionSeries.Transition
                key={`transition-${scene.sceneId}`}
                presentation={presentation}
                timing={linearTiming({ durationInFrames: TRANSITION_DURATION_FRAMES })}
              />
            );
          }
          return elements;
        })}
      </TransitionSeries>

      <Audio src={staticFile(audioPath)} />

      {music && <Audio src={staticFile(music.path)} volume={music.volume ?? 0.25} loop />}

      {sfx.map((s) => (
        <Sequence key={`sfx-${s.sceneId}`} from={Math.round(s.atSec * fps)}>
          <Audio src={staticFile(s.sfxPath)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
