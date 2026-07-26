import path from "node:path";
import fs from "node:fs/promises";
import { runStoryboardEngine } from "./orchestrator.js"; // adjust path to your module



export class Embedder {
  /**
   * @param {Function} embedFn - Async function taking text or array of texts and returning vector(s).
   */
  constructor(embedFn) {
    if (typeof embedFn !== "function") {
      throw new Error("Embedder requires a valid embedding function.");
    }
    this.embedFn = embedFn;
  }

  /**
   * Embeds a single string or an array of strings.
   * @param {string | string[]} input 
   * @returns {Promise<number[] | number[][]>}
   */
  async embed(input) {
    if (Array.isArray(input)) {
      if (input.length === 0) return [];
      return await this.embedFn(input);
    }
    const results = await this.embedFn([input]);
    return results[0];
  }
}

import { pipeline } from "@xenova/transformers";

// Lazy-load the model
let extractor = null;

export const localEmbedder = new Embedder(async (texts) => {
  if (!extractor) {
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  
  const outputs = await Promise.all(
    texts.map((text) => extractor(text, { pooling: "mean", normalize: true }))
  );
  
  return outputs.map((out) => Array.from(out.data));
});

import { parseArgs } from "node:util";

async function main() {
  const { values } = parseArgs({
    options: {
      config: {
        type: "string",
        short: "c",
      },
      storyboard: {
        type: "string",
        short: "s",
      },
      output: {
        type: "string",
        short: "o",
      },
      "skip-render": {
        type: "boolean",
      },
    },
  });
  if (!values.config || !values.storyboard) {
    console.error(`
  Usage:
    node index.js --config <config.json> --storyboard <storyboard.json> [options]

  Required:
    -c, --config       Path to storyboard config JSON
    -s, --storyboard   Path to storyboard JSON

  Optional:
    -o, --output       Override output directory
        --skip-render  Skip video rendering
  `);
    process.exit(1);
  }

  // Load configuration and input data
  const config = JSON.parse(await fs.readFile(values.config, "utf-8"));
  const storyboard = JSON.parse(await fs.readFile(values.storyboard, "utf-8"));

  // CLI overrides
  if (values.output) {
    config.outputDir = values.output;
  }
  if (values["skip-render"] !== undefined) {
    config.skipRender = values["skip-render"];
  }

  // Assemble the `opts` object required by runStoryboardEngine
  const opts = {
    outputDir: path.resolve(config.outputDir),
    templatesRoot: path.resolve(config.templatesRoot),
    selectionThreshold: config.selectionThreshold,
    skipRender: config.skipRender,
    scoringWeights: config.scoringWeights,
    storyboard,
    embedder: localEmbedder,
    voicecfg: config.voicecfg,
    cfg: config.cfg,
  };

  console.log("Starting Storyboard Engine...");

  try {
    const result = await runStoryboardEngine(opts);

    console.log("Engine execution complete!");
    console.log(
      `Discovered Template Families: ${result.templateFamilies.length}`
    );

    if (result.videoPath) {
      console.log(`Video rendered successfully to: ${result.videoPath}`);
    } else {
      console.log("Render skipped per configuration.");
    }
  } catch (error) {
    console.error("Error executing Storyboard Engine:", error);
    process.exit(1);
  }
}

main();