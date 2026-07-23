import fs from "node:fs";
import path from "node:path";

const REQUIRED_SEGMENT_FIELDS = ["id", "text"];

/**
 * Loads and validates a storyboard JSON file from disk into the shape
 * `renderVideo()` expects. See skills/storyboard-json/SKILL.md for the full
 * authoring guide and skills/storyboard-json/references/schema.md for the
 * formal schema.
 *
 * @param {string} storyboardPath path to a *.storyboard.json file
 * @returns {{
 *   voiceoverSegments: Array<Object>,
 *   voiceConfig: Object,
 *   outputPath?: string,
 *   masterSeed?: string,
 *   fps?: number,
 *   width?: number,
 *   height?: number,
 * }}
 */
export function loadStoryboard(storyboardPath) {
  const absolutePath = path.resolve(storyboardPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Storyboard file not found: ${absolutePath}`);
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(absolutePath, "utf-8"));
  } catch (err) {
    throw new Error(`Storyboard file at ${absolutePath} is not valid JSON: ${err.message}`);
  }

  validateStoryboard(raw, absolutePath);

  // outputPath in the storyboard is resolved relative to the storyboard
  // file's own directory, so storyboards remain portable across machines.
  const resolvedOutputPath = raw.outputPath
    ? path.resolve(path.dirname(absolutePath), raw.outputPath)
    : undefined;

  return {
    voiceoverSegments: raw.voiceoverSegments,
    voiceConfig: raw.voiceConfig || {},
    outputPath: resolvedOutputPath,
    masterSeed: raw.masterSeed,
    fps: raw.fps,
    width: raw.width,
    height: raw.height,
  };
}

function validateStoryboard(raw, sourcePath) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`Storyboard at ${sourcePath} must be a JSON object.`);
  }

  if (!Array.isArray(raw.voiceoverSegments) || raw.voiceoverSegments.length === 0) {
    throw new Error(
      `Storyboard at ${sourcePath} must include a non-empty "voiceoverSegments" array.`
    );
  }

  raw.voiceoverSegments.forEach((segment, index) => {
    for (const field of REQUIRED_SEGMENT_FIELDS) {
      if (!segment || typeof segment[field] === "undefined" || segment[field] === "") {
        throw new Error(
          `voiceoverSegments[${index}] in ${sourcePath} is missing required field "${field}".`
        );
      }
    }
    if (segment.embedding !== undefined && !Array.isArray(segment.embedding)) {
      throw new Error(
        `voiceoverSegments[${index}].embedding in ${sourcePath} must be an array of numbers if provided.`
      );
    }
    if (segment.media !== undefined && typeof segment.media !== "object") {
      throw new Error(
        `voiceoverSegments[${index}].media in ${sourcePath} must be an object mapping asset slot names to URLs.`
      );
    }
  });

  if (raw.voiceConfig !== undefined && typeof raw.voiceConfig !== "object") {
    throw new Error(`"voiceConfig" in ${sourcePath} must be an object if provided.`);
  }
}
