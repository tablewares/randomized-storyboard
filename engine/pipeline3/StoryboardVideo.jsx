import React, { Suspense } from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";

// Import dynamically generated structure components registry
import { STRUCTURE_COMPONENTS } from "./Structures.jsx";

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

  // Transition timing math — keeps pipeline-1's `startSec`/`endSec` the
  // actual on-screen timing truth despite Remotion's <TransitionSeries>
  // shortening the timeline by TRANSITION_DURATION_FRAMES per transition.
  //
  // Background: a <TransitionSeries.Transition> between two sequences
  // overlaps them — Remotion shifts the entering scene *backward* in time
  // so both scenes render during the transition window (per docs: "it
  // shifts the next scene backward in time so both scenes render
  // simultaneously during the transition window" and "it shortens the
  // total duration because both scenes overlap during the transition").
  // Without correction, scene N+1's frame-zero lands at
  // `Σ_durations_so_far - N*T`, T frames BEFORE its pipeline-1
  // `startSec*fps` — so the entering scene's animations fire before its
  // voiceover audio (which plays linearly from frame 0) reaches that
  // point. The desync compounds: by scene N the visual is N*T frames
  // ahead of the audio at 30fps.
  //
  // Fix: extend every scene that has an outgoing transition by T frames.
  // Then Remotion's backward-pull lands scene N+1's frame-zero at
  //   Σ_durations_so_far - priorTransitions*T ≈ Math.round(startSec_{N+1} * fps)
  // by construction (within 1 frame per-scene rounding). The entering
  // scene's `useCurrentFrame()` now reads 0 at the same wall-clock
  // instant its voiceover starts, so animations stay in sync with TTS.
  // The same one-T-per-transition correction means the visual end of each
  // scene sits at `frameZero + rawDuration`, which is where SFX is now
  // placed (see the `visualEndFrameBySceneId` map below) instead of the
  // raw `endSec*fps` that previously fired T frames late.
  const hasOutgoingTransition = scenes.map((_, i) => i < scenes.length - 1);

  const sceneFrames = scenes.map((s, i) => {
    const rawDuration = Math.round((s.timing.endSec - s.timing.startSec) * fps);
    // Remotion's <TransitionSeries> shifts the ENTERING scene backward in
    // time by TRANSITION_DURATION_FRAMES so it renders simultaneously with
    // the exiting scene's last T frames. Without correction, scene N+1's
    // visual entry lands at frame `Σ_durations_so_far - N*T`, which is T
    // frames BEFORE its pipeline-1 `startSec*fps` says it should — i.e.
    // the entering scene visually animates before its voiceover audio
    // (which plays linearly from frame 0) reaches that point. The desync
    // compounds: by scene N the visual is N*T frames ahead of the audio.
    //
    // Fix: extend every scene that has an outgoing transition by T frames.
    // Then when Remotion pulls scene N+1 back by T, scene N+1 still lands
    // at frame `(rawDur_N + T) + rawDur_{N-1}+T... - N*T ≈ round(startSec_{N+1} * fps)`.
    // The earlier `round(startSec*fps)` per-scene approach independently
    // rounded each boundary AND ignored the transition overlap entirely;
    // computing cumulative offsets from these extended durations keeps
    // every scene's visual entry frame consistent with pipeline-1's
    // contiguous timeline (endSec_i == startSec_{i+1}).
    //
    // Math.max(1) guards against scene-budget == 0 (Remotion requires
    // positive integer durationInFrames).
    const transitionExt = hasOutgoingTransition[i]
      ? TRANSITION_DURATION_FRAMES
      : 0;
    const duration = Math.max(1, rawDuration + transitionExt);
    return {
      scene: s,
      // Filled below: cumulative offset over the *extended* durations, so
      // the entering scene's `fromFrame` lines up with startSec*fps *after*
      // Remotion's backward-T pull on it.
      fromFrame: 0,
      durationInFrames: duration,
    };
  });

  // Fill cumulative frame offsets. Each scene's `fromFrame` is its
  // Remotion frame-zero — what its internal `useCurrentFrame()` sees as 0.
  // Because Remotion's `<TransitionSeries>` shortens the total by T per
  // transition (each transition overlaps two scenes), each prior
  // transition pulls the entering scene's frame-zero backward by T. So:
  //   scene_i.remotionFrameZero = Σ_durations_before_i - priorTransitions_i * T
  // which by construction equals Math.round(startSec_i * fps) (within 1
  // frame of per-scene rounding). That's why the entering scene's
  // animations fire in sync with its voiceover — they both align with
  // pipeline-1's contiguous-partition timing (endSec_i == startSec_{i+1}).
  let cursorFrame = 0;
  let transitionsBefore = 0;
  for (const f of sceneFrames) {
    f.fromFrame = cursorFrame - transitionsBefore * TRANSITION_DURATION_FRAMES;
    cursorFrame += f.durationInFrames;
    if (transitionsBefore < sceneFrames.length - 1) transitionsBefore++;
  }

  // Build per-scene lookup of the *visual* end frame — the frame the
  // viewer perceives as "scene N just ended" (the last frame of scene N's
  // own content before the next scene's transition takes it over). That's
  // `remotionFrameZero + rawDuration` for the scene, where rawDuration is
  // the scene's pipeline-1 budget BEFORE the T-frame extension we added to
  // cushion the crossfade. This is the frame SFX should land on.
  const visualEndFrameBySceneId = new Map();
  for (const f of sceneFrames) {
    visualEndFrameBySceneId.set(
      f.scene.sceneId,
      f.fromFrame + Math.round((f.scene.timing.endSec - f.scene.timing.startSec) * fps)
    );
  }
  const transitionByPair = new Map(transitions.map((t) => [`${t.betweenSceneId}->${t.andSceneId}`, t.type]));

  return (
    <AbsoluteFill>
      <TransitionSeries>
        {sceneFrames.map(({ scene, durationInFrames }, i) => {
          const prev = sceneFrames[i - 1]?.scene;
          const transitionType = prev ? transitionByPair.get(`${prev.sceneId}->${scene.sceneId}`) ?? "cut" : "cut";
          const presentation = presentationForTransition(transitionType);

          // Look up the structure component by filename from the dynamic registry
          const StructureComponent = STRUCTURE_COMPONENTS[scene.structurePath];

          const elements = [
            <TransitionSeries.Sequence key={`scene-${scene.sceneId}`} durationInFrames={durationInFrames}>
              <Suspense fallback={<AbsoluteFill style={{ background: scene.style.palette?.background ?? "#000" }} />}>
                {StructureComponent ? (
                  <StructureComponent content={scene.content} style={scene.style} animation={scene.animation} />
                ) : (
                  <AbsoluteFill style={{ background: scene.style.palette?.background ?? "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ color: "white", fontSize: 48 }}>Missing template: {scene.structurePath}</div>
                  </AbsoluteFill>
                )}
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

      {audioPath && <Audio src={staticFile(audioPath)} />}

      {music && <Audio src={staticFile(music.path)} volume={music.volume ?? 0.25} loop />}

      {sfx.map((s) => {
        // Place the SFX at the visual scene-end frame, not the raw
        // `atSec * fps`. Earlier this used `Math.round(s.atSec * fps)`,
        // which lands at the raw pipeline-1 end boundary. But the
        // previous scene's content ends TRANSITION_DURATION_FRAMES before
        // that boundary (the crossfade eats the out-scene's tail), so the
        // viewer perceives the scene as "done" earlier than `atSec`. Using
        // the computed visual end frame makes the sfx fire exactly when
        // the scene's own content disappears into the crossfade — the
        // "punctuation" the SFX is meant to be — rather than 15 frames
        // later when the *next* scene is already visible. Fall back to
        // `atSec * fps` rounded when we have no entry for the scene
        // (e.g. the trailing scene whose visual end equals its endSec).
        const visualEndFrame = visualEndFrameBySceneId.get(s.sceneId);
        const sfxFromFrame =
          visualEndFrame !== undefined
            ? visualEndFrame
            : Math.round(s.atSec * fps);
        return (
          <Sequence key={`sfx-${s.sceneId}`} from={sfxFromFrame}>
            <Audio src={staticFile(s.sfxPath)} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
