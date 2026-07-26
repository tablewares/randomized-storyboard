# Pipeline 3 — Structure Loading (post-2025-07-25 refactor)

How template `structure*.jsx` files reach the Remotion bundle. Read this before
touching `engine/pipeline3/copyStructures.js`, `Structures.jsx`, or the
`structurePath` field on scenes.

## The mechanism (current)

`engine/pipeline3/copyStructures.js` exports a single function:

```js
generateStructuresModule(templateRegistry, outputPath)
```

`preparePipeline3` (in `engine/pipeline3/index.js`) calls it every render with
the real `pipeline1.templateRegistry` and the path
`engine/pipeline3/Structures.jsx`. The function writes a module whose imports
point **directly at the original template files** under
`templates/<family>/<id>/<structure>.jsx` — e.g.

```js
import Structure_0 from "../../templates/lists/basic/structure1.jsx";
```

The relative path is computed with `path.relative(dirname(outputPath),
path.join(template.dir, variation.structure))` and backslashes are normalized
to `/` for cross-platform safety. **Nothing is copied into `public/`.** The
old `copyStructureFiles` function and the `public/structures/` directory it
populated no longer exist — do not re-add them.

## The lookup key (composite — both sides must agree)

`Structures.jsx` exports `STRUCTURE_COMPONENTS` keyed by

```
<safeFamily>-<safeTemplateId>-<structureFilename>
```

where `safeFamily = template.family.replace(/\//g, "-")`,
`safeTemplateId = template.id.replace(/\//g, "-")`, and
`structureFilename = variation.structure` (a bare filename like
`structure1.jsx`). Example key: `lists-basic-structure1.jsx`.

`engine/pipeline3/index.js` builds the **same** key on each scene's
`structurePath` (lines ~93–96):

```js
const safeFamily = template.family.replace(/\//g, "-");
const safeTemplateId = template.id.replace(/\//g, "-");
const structureFilename = path.basename(scene.structurePath);
const structureKey = `${safeFamily}-${safeTemplateId}-${structureFilename}`;
```

`StoryboardVideo.jsx` then does `STRUCTURE_COMPONENTS[scene.structurePath]`.
**If either side changes the key format, the other MUST change to match or
every render silently falls back to the "Missing template" card.**

## Pitfall — the divergence that was on `main` before this refactor

Before 2025-07-25 the committed `Structures.jsx` had been generated with
**plain-filename keys** (e.g. `"structure1.jsx"`) while `index.js` was building
**composite** keys (`"lists-basic-structure1.jsx"`). Result: NO scene ever
matched a key in `STRUCTURE_COMPONENTS` — every render rendered the
"Missing template" fallback. The bug was silent because the fallback card
renders without throwing.

**Lesson:** when changing the key format, regenerate `Structures.jsx` in the
same commit and assert (via a script) that every scene-side key exists in the
generated `STRUCTURE_COMPONENTS`. See the verification recipe below.

## Verifying the refactor (no canonical test command in this repo)

`package.json` has only an `example` script, and that script fails early on an
unrelated pre-existing bug (`audioPath` is null from the fake pipeline1).
Verify structure-loading changes with a throwaway script instead — load the real
`discoverTemplates` + `generateStructuresModule`, regenerate the file in place,
then assert against the on-disk artifact:

```js
import path from "node:path";
import { readFile, stat } from "node:fs/promises";
const { discoverTemplates } = await import("./engine/templates/discovery.js");
const { generateStructuresModule } = await import("./engine/pipeline3/copyStructures.js");

const registry = (await discoverTemplates("./templates")).registry;
const outDir = "./engine/pipeline3";
const outputPath = path.join(outDir, "Structures.jsx");
await generateStructuresModule(registry, outputPath);
const content = await readFile(outputPath, "utf-8");

const imports = [...content.matchAll(/^import\s+\w+\s+from\s+"([^"]+)";$/gm)].map(m => m[1]);
const keys = [...content.matchAll(/^\s+"([^"]+)":\s+\w+,?$/gm)].map(m => m[1]);

// 1. every import resolves to a real original file
for (const rel of imports) await stat(path.resolve(outDir, rel));
// 2. every (template, variation) scene-side key exists in STRUCTURE_COMPONENTS
for (const [, t] of registry.entries()) {
  const sf = t.family.replace(/\//g, "-"), si = t.id.replace(/\//g, "-");
  for (const v of t.variations ?? []) {
    const key = `${sf}-${si}-${v.structure}`;
    if (!keys.includes(key)) throw new Error("missing key: " + key);
  }
}
// 3. no import points at the old copy destination
if (imports.some(p => p.includes("public/structures"))) throw new Error("stale copy import");
console.log("OK");
```

Run it green, then delete it — don't commit one-off verifiers to the repo. The
repo has no `npm test` / lint / build; this is the canonical ad-hoc pattern.

## Related files (current `engine/` layout — supersedes old `src/` references)

- `engine/templates/discovery.js` — `discoverTemplates(rootDir)` → registry of
  `{ ...manifest, id, family, templateId, dir, manifestPath }`. `dir` is the
  absolute path to the template folder; `variations[].structure` is a bare
  filename relative to `dir`.
- `engine/pipeline3/copyStructures.js` — `generateStructuresModule` (ONLY export;
  `copyStructureFiles` is gone).
- `engine/pipeline3/index.js` — `preparePipeline3` calls the generator and builds
  per-scene composite keys. Returns `{ renderInput }` (the old `structureMap`
  field was removed — no caller used it).
- `engine/pipeline3/Structures.jsx` — AUTO-GENERATED. Never hand-edit.
- `engine/pipeline3/StoryboardVideo.jsx` — consumes
  `STRUCTURE_COMPONENTS[scene.structurePath]`.
