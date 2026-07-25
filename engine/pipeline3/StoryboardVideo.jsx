import React, { Suspense } from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";

const TRANSITION_DURATION_FRAMES = 15;

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
      // No dedicated zoom preset shipped by @remotion/transitions at time of
      // writing; fall back to a fade which still reads as a soft blend.
      return fade();
    case "cut":
    default:
      return null; // hard cut: render as a plain Sequence, no TransitionSeries entry
  }
}

/**
 * Dynamically loads a template's structure file (a React component) by
 * absolute path. Structure files are plain default-export React components
 * that accept `{ content, style, animation }` props - see
 * templates/lists/basic/structure1.jsx for the reference shape.
 */
function loadStructureComponent(structurePath) {
  return React.lazy(() => import(/* webpackIgnore: false */ structurePath));
}

function SceneContent({ scene }) {
  const Structure = loadStructureComponent(scene.structurePath);
  return (
    <Suspense fallback={<AbsoluteFill style={{ background: scene.style.palette?.background ?? "#000" }} />}>
      <Structure content={scene.content} style={scene.style} animation={scene.animation} />
    </Suspense>
  );
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
      {/* ---- Visual scenes, stitched with per-pair transitions ---- */}
      <TransitionSeries>
        {sceneFrames.map(({ scene, durationInFrames }, i) => {
          const prev = sceneFrames[i - 1]?.scene;
          const transitionType = prev ? transitionByPair.get(`${prev.sceneId}->${scene.sceneId}`) ?? "cut" : "cut";
          const presentation = presentationForTransition(transitionType);

          const elements = [
            <TransitionSeries.Sequence key={`scene-${scene.sceneId}`} durationInFrames={durationInFrames}>
              <SceneContent scene={scene} />
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

      {/* ---- Continuous voiceover, one long file spanning the whole video ---- */}
      <Audio src={audioPath} />

      {/* ---- Background music ---- */}
      {music && <Audio src={resolveAudioSrc(music.path)} volume={music.volume ?? 0.25} loop />}

      {/* ---- SFX at each scene's end timestamp ---- */}
      {sfx.map((s) => (
        <Sequence key={`sfx-${s.sceneId}`} from={Math.round(s.atSec * fps)}>
          <Audio src={resolveAudioSrc(s.sfxPath)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

function resolveAudioSrc(p) {
  // Absolute/remote paths are used as-is; bare filenames are resolved via
  // Remotion's public/staticFile convention.
  if (p.startsWith("http") || p.startsWith("/")) return p;
  return staticFile(p);
}
