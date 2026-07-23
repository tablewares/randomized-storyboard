/**
 * Node-only filesystem path constants. Deliberately separate from
 * config.js: this file is imported by pipeline1 (scoring.js) and render.js,
 * which only ever run in Node -- never by pipeline3/index.jsx (the
 * webpack/browser bundle entry).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Template roots, in resolution order.
export const PRIMARY_TEMPLATE_ROOT = path.join(__dirname, "..", "templates");
export const SECONDARY_TEMPLATE_ROOT = path.join(__dirname, "..", "templates-secondary");

// Where scenes that fail to match anywhere get logged.
const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

export const UNMATCHED_LOG_PATH = path.join(
  __dirname,
  "..",
  "unmatched",
  `unmatched_scenes_${date}.json`
);