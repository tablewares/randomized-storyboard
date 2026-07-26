// Batched verification for randomized-storyboard templates the existing
// discovery validator (references/validate-template.mjs) does NOT cover:
//
//   Stage 1 — delegate to validate-template.mjs (discovery + registry +
//             structure-file-exists + keyword check). MUST be issues:0.
//   Stage 2 — esbuild JSX compile of every structure .jsx in the catalog.
//             esbuild is the exact transpiler Remotion uses at render time,
//             so a structure that compiles here will compile at render. This
//             catches genuine JSX/syntax errors that Node's stock ESM loader
//             can't (it aborts on the .jsx extension before parsing).
//   Stage 3 — manifest structural re-check: every supportedContentKeys entry
//             is in engine/contentKeys/registry.js, variation ids unique, and
//             every referenced structure file exists + is non-empty.
//
// Usage:
//   node scripts/verify-template-compile.mjs                          # whole catalog
//   node scripts/verify-template-compile.mjs templates/lists/basic/  # one template
//
// Exits 0 only if every stage passes. Temp-file-safe: writes nothing to disk.

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, relative, sep } from "node:path";

const ROOT = process.env.RANDOMIZED_STORYBOARD_ROOT || "/home/tablewares/random/randomized-storyboard";
const SKILL_DIR = new URL("..", import.meta.url).pathname; // scripts/ -> skill root
const VALIDATOR = join(SKILL_DIR, "references", "validate-template.mjs");
const ESBUILD = join(ROOT, "node_modules", ".bin", "esbuild");
const REGISTRY = join(ROOT, "engine", "contentKeys", "registry.js");
const TEMPLATES_ROOT = join(ROOT, "templates");

const targetArg = process.argv[2];
let targets = [];
let failed = 0;
const ok = (m) => console.log("  [pass]", m);
const fail = (m) => { console.log("  [FAIL]", m); failed++; };

// --- gather templates to verify (cheap manifest scan, mirrors discovery) ---
function findTemplates(dir, acc) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    const sub = join(dir, name.name);
    if (existsSync(join(sub, "manifest.json"))) {
      acc.push(sub); // discovery stops descending at a manifest — mirror that
    } else {
      findTemplates(sub, acc);
    }
  }
  return acc;
}
let allDirs = findTemplates(TEMPLATES_ROOT, []);
if (targetArg) {
  const abs = resolve(targetArg);
  allDirs = allDirs.filter((d) => d === abs || d.startsWith(abs + sep));
  if (allDirs.length === 0) { console.error(`no template found under ${targetArg}`); process.exit(1); }
}
targets = allDirs.map((dir) => ({ dir, manifestPath: join(dir, "manifest.json") }));

// --- Stage 1: the authoritative discovery validator ---
console.log("\n== Stage 1: discoverTemplates() validation ==");
let valOut;
try {
  valOut = execSync(`node "${VALIDATOR}"${targetArg ? ` "${targetArg}"` : ""}`, { cwd: ROOT, encoding: "utf8" });
  process.stdout.write(valOut);
} catch (e) {
  valOut = (e.stdout || "") + (e.stderr || "");
  process.stdout.write(valOut);
  fail(`validator exited ${e.status}`);
}
const issuesCount = parseInt((valOut.match(/issues:\s*(\d+)/i) || [])[1] ?? "-1", 10);
if (issuesCount === 0) ok("issues: 0 (catalog clean)");
else fail(`expected issues:0, got ${issuesCount}`);

// --- Stage 2: esbuild JSX compile (Remotion's bundler) ---
console.log("\n== Stage 2: esbuild JSX compile (Remotion's bundler) ==");
if (!existsSync(ESBUILD)) fail(`esbuild binary missing at ${ESBUILD}`);
else {
  for (const t of targets) {
    for (const f of readdirSync(t.dir).filter((f) => f.endsWith(".jsx"))) {
      const full = join(t.dir, f);
      const rel = relative(ROOT, full);
      try {
        execSync(`"${ESBUILD}" --bundle --external:react --external:remotion --format=esm --outfile=/dev/null "${full}"`, { cwd: ROOT, encoding: "utf8", stdio: "pipe" });
        ok(`compiled: ${rel}`);
      } catch (e) {
        const msg = (e.stderr || e.stdout || "").split("\n").filter(Boolean).slice(0, 3).join(" | ");
        fail(`esbuild rejected ${rel}: ${msg}`);
      }
    }
  }
}

// --- Stage 3: manifest structural checks ---
console.log("\n== Stage 3: manifest structural checks ==");
const regSrc = readFileSync(REGISTRY, "utf8");
const known = new Set([...regSrc.matchAll(/^\s{2}(\w+):\s*\{ key:/gm)].map((m) => m[1]));
for (const t of targets) {
  const rel = relative(ROOT, t.dir).replace(/\\/g, "/");
  let m;
  try {
    m = JSON.parse(readFileSync(t.manifestPath, "utf8"));
  } catch (e) {
    fail(`${rel}: manifest.json not valid JSON (${e.message.split("\n")[0]})`);
    continue;
  }
  for (const k of Object.keys(m.supportedContentKeys ?? {})) {
    known.has(k) ? ok(`${rel}: key "${k}" in registry`) : fail(`${rel}: unknown key "${k}"`);
  }
  const ids = (m.variations ?? []).map((v) => v.id);
  new Set(ids).size === ids.length ? ok(`${rel}: variation ids unique (${ids.join(",")})`) : fail(`${rel}: duplicate variation ids`);
  for (const v of m.variations ?? []) {
    const sp = join(t.dir, v.structure);
    existsSync(sp) && statSync(sp).size > 0 ? ok(`${rel}: ${v.structure} exists+non-empty for "${v.id}"`) : fail(`${rel}: missing/empty ${v.structure}`);
  }
}

console.log("\n== Summary ==");
console.log(`  templates verified: ${targets.length}`);
console.log(`  failures: ${failed}`);
process.exit(failed ? 1 : 0);
