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

async function main() {
  // Load configuration and input data
  const config = JSON.parse(await fs.readFile("./storyboard.config.json", "utf-8"));
  const storyboard = JSON.parse(await fs.readFile("./storyboard.long.json", "utf-8"));

  // Mock or real embedder instance (e.g., OpenAI, HuggingFace, or custom vector function)
  const embedder = {
    async embed(text) {
      // Replace with your actual embedding function if required
      return [/* vector embeddings */];
    }
  };

  // Assemble the `opts` object required by runStoryboardEngine
  const opts = {
    outputDir: path.resolve(config.outputDir),
    templatesRoot: path.resolve(config.templatesRoot),
    selectionThreshold: config.selectionThreshold,
    skipRender: config.skipRender,
    scoringWeights: config.scoringWeights,
    storyboard: storyboard,
    embedder: localEmbedder,
    voicecfg: config.voicecfg,
    cfg: config.cfg
  };

  console.log("Starting Storyboard Engine...");
  
  try {
    const result = await runStoryboardEngine(opts);
    
    console.log("Engine execution complete!");
    console.log(`Discovered Template Families: ${result.templateFamilies.length}`);
    if (result.videoPath) {
      console.log(`Video rendered successfully to: ${result.videoPath}`);
    } else {
      console.log("Render skipped per configuration.");
    }
  } catch (error) {
    console.error("Error executing Storyboard Engine:", error);
  }
}

main();