// Run with: npx tsx examples/run-example.js  (or plain `node examples/run-example.js`
// since this whole project is now plain JS/JSX, no TypeScript compile step needed)
//
// Exercises pipelines 1 and 2, plus pipeline 3's data-assembly step, using a
// fake ttsAlignFn so it runs anywhere without a real TTS/whisperX stack or a
// Remotion/chromium environment. Swap `fakeTtsAlignFn` for your real
// implementation (see engine/pipeline1/voiceover.js for the expected shape).

import { discoverTemplates } from "../engine/templates/discovery.js";
import { runPipeline1 } from "../engine/pipeline1/index.js";
import { runPipeline2 } from "../engine/pipeline2/index.js";
import { preparePipeline3 } from "../engine/pipeline3/index.js";
import path from "node:path";

/** @type {import("../types.js").Storyboard} */
const storyboard = {
  id: "demo-1",
  seed: "seed-42", // change this to reshuffle variations/transitions/sfx deterministically
  voice: { provider: "fake-tts", voiceId: "narrator-1" },
  globalStyle: { palette: { accent: "#00ffaa" } },
  scenes: [
    {
      id: "scene-1",
      voiceover: "Here are the top three things you need to know.",
      family: "lists", // optional hint; scoring still runs, just scoped
      keywords: ["top", "ranking"],
      content: {
        title: "Top 3 Things To Know",
        description: "A quick rundown before we dive in.",
        items: ["Speed matters", "Consistency wins", "Details compound"],
      },
    },
    {
      id: "scene-2",
      voiceover: "Number one: always ship on time.",
      keywords: ["list", "steps"],
      content: {
        title: "Step One",
        items: ["Always ship on time", "Communicate blockers early"],
      },
    },
  ],
};
const cfg = {
  render: true
};

async function main() {
  const templatesRoot = path.resolve("templates");
  console.log("templates root:", templatesRoot);
  const { registry, families, issues } = await discoverTemplates(templatesRoot);
  console.log("discovered families:", families);
  if (issues.length) console.warn("discovery issues:", issues);

  const pipeline1 = await runPipeline1(storyboard, {
    templateRegistry: registry,
    selectionThreshold: 0.6
  });
  if (pipeline1.warnings.length) {
    console.warn("template selection warnings (agent should review):", pipeline1.warnings);
  }

  const pipeline2 = runPipeline2(storyboard, pipeline1, { templateRegistry: registry });
  const { renderInput } = await preparePipeline3(storyboard, pipeline1, pipeline2, cfg);

  console.log(JSON.stringify({ pipeline1, pipeline2, renderInput }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
