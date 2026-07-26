# Remotion Rendering Fixes

## Issue: `staticFile()` rejects absolute paths

**Error:**
```
TypeError: staticFile() does not support absolute paths - got "/home/tablewares/random/randomized-storyboard/combined_voice.mp3". Instead, pass the name of a file that is inside the public/ folder.
```

**Root Cause:** Remotion's `staticFile()` helper only accepts relative paths to files inside the `public/` directory. It cannot load arbitrary absolute filesystem paths.

**Solution (applied in session):**
1. Copy all audio assets (voice MP3, SFX, music) to the project's `public/` folder
2. Reference them by filename only in the render input JSON
3. Use `staticFile(filename)` in the Remotion component

### Implementation in Pipeline 3

In `engine/pipeline3/index.js` (preparePipeline3):
```javascript
// Copy audio file to public folder for Remotion to serve
const publicDir = path.join(__dirname, "../../public");
await mkdir(publicDir, { recursive: true });

let audioPath = pipeline1.audioPath;
// Use path.isAbsolute() for cross-platform absolute path detection (works on Windows and Unix)
if (path.isAbsolute(audioPath)) {
  const audioFilename = path.basename(audioPath);
  const destPath = path.join(publicDir, audioFilename);
  await copyFile(audioPath, destPath);
  audioPath = audioFilename; // Just the filename for Remotion
}
```

In `engine/pipeline3/StoryboardVideo.jsx`:
```javascript
<Audio src={staticFile(audioPath)} />
```

## Issue: Output video named `undefined.mp4`

**Error:** Video renders successfully but output file is named `undefined.mp4`

**Root Cause:** The orchestrator uses `opts.storyboard.id` for the output filename, but the storyboard JSON didn't have an `id` field.

**Solution:** Ensure storyboard JSON includes `"id": "your-storyboard-id"` field.

Example:
```json
{
  "id": "storyboard-1",
  "scenes": [...]
}
```

## Issue: Music/SFX not playing

**Root Cause:** Same as absolute path issue - SFX and music files referenced by absolute paths in render input, but Remotion can't serve them.

**Solution:** Copy SFX and music files to `public/` folder alongside the voice audio, and reference by filename.

## Cross-Platform Absolute Path Detection (Windows vs Linux) — NEW 2025-07-25

**Error on Windows:**
```
SymbolicateableError [TypeError]: staticFile() does not support absolute paths - got "C:\Users\froze\Downloads\storyboard-engine-jsx\combined_voice.mp3".
```

**Root Cause:** The original fix checked for Unix-specific absolute path prefixes (`/home/`, `/mnt/`, `/Users/`, `/root/`) which don't exist on Windows (where paths start with `C:\`, `D:\`, etc.).

**Fix Applied:** Replaced hardcoded Unix prefix checks with `path.isAbsolute()` from Node.js `path` module, which correctly detects absolute paths on both Windows (`C:\...`, `\\server\...`) and Unix (`/home/...`).

**Files Modified:**
- `engine/pipeline3/index.js` — lines 46-72: use `path.isAbsolute()` for audio/music/SFX
- `engine/pipeline3/sfxSelection.js` — line 7: `PUBLIC_SFX_DIR = path.join(__dirname, "../../public")`

## Quick Fix Checklist for New Runs

- [ ] Create `public/` folder in project root if missing
- [ ] Ensure storyboard JSON has `"id"` field
- [ ] Ensure all audio assets (voice, SFX, music) copied to `public/` before render
- [ ] Verify `render-input.json` references files by filename only (no paths)
- [ ] Check `StoryboardVideo.jsx` uses `staticFile(filename)` for all audio
- [ ] Use `path.isAbsolute()` for any absolute path detection (not hardcoded prefixes)