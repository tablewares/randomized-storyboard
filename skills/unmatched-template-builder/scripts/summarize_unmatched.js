#!/usr/bin/env node
/**
 * Summarizes unmatched_scenes.json into a triage-friendly report:
 * groups records by their closest-but-still-failing template, and flags
 * the most likely reason each group missed THRESHOLD (weak exact-key
 * match, capacity mismatch, or weak cosine similarity), using the
 * SCORING_WEIGHTS from src/config.js to weigh each signal's contribution.
 *
 * Usage:
 *   node skills/unmatched-template-builder/scripts/summarize_unmatched.js [path/to/unmatched_scenes.json]
 *
 * Defaults to config.UNMATCHED_LOG_PATH (project root / unmatched_scenes.json)
 * if no path is given.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../../"); // skills/<name>/scripts -> project root

async function main() {
  const logPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(projectRoot, "unmatched_scenes.json");

  if (!fs.existsSync(logPath)) {
    console.log(`No unmatched_scenes.json found at ${logPath}. Nothing to triage.`);
    return;
  }

  const records = JSON.parse(fs.readFileSync(logPath, "utf-8"));
  if (!Array.isArray(records) || records.length === 0) {
    console.log("unmatched_scenes.json is empty. Nothing to triage.");
    return;
  }

  let { SCORING_WEIGHTS } = await import(path.join(projectRoot, "src/config.js"));

  const byKey = new Map(); // bestPrimaryKey -> records[]
  for (const record of records) {
    const key = record.bestPrimaryKey || "(no primary templates loaded)";
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(record);
  }

  console.log(`\n${records.length} unmatched scene(s) across ${byKey.size} closest-template group(s):\n`);

  for (const [templateKey, group] of byKey) {
    console.log(`── closest template: "${templateKey}" (${group.length} scene${group.length > 1 ? "s" : ""})`);

    for (const record of group) {
      const b = record.bestPrimaryBreakdown;
      const reasons = [];
      if (b) {
        if (b.exactKeyScore * SCORING_WEIGHTS.exactKey < 0.5 * SCORING_WEIGHTS.exactKey) {
          reasons.push("no exact key match");
        }
        if (b.charCapacityScore < 0.6) {
          reasons.push(`char count ${record.charCount} outside capacity band (fit score ${b.charCapacityScore.toFixed(2)})`);
        }
        if (b.cosineScore < 0.5) {
          reasons.push(`low semantic similarity (cosine score ${b.cosineScore.toFixed(2)})`);
        }
      } else {
        reasons.push("no template scored (check /templates and /templates-secondary exist and have valid manifests)");
      }

      console.log(`   • ${record.sceneId}: score=${record.bestPrimaryScore?.toFixed(2) ?? "n/a"} vs threshold=${record.threshold}`);
      console.log(`     text: "${truncate(record.text, 80)}"`);
      console.log(`     likely reason(s): ${reasons.join("; ")}`);
    }
    console.log("");
  }

  console.log(
    "Next step: for each group above, either loosen/extend the closest template's " +
      "manifest.json (capacity range, add a layoutVariant/styleVariant, adjust its " +
      "embedding), or build a brand-new template if none of the existing ones are " +
      "a reasonable starting point. See ../SKILL.md and ../references/manifest-schema.md."
  );
}

function truncate(text, maxLen) {
  if (!text) return "";
  return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
