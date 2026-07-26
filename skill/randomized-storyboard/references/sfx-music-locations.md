# SFX & Music Locations in Render Pipeline

## SFX (Sound Effects)

**Source Configuration:** `storyboard.sfxDir` — specified in storyboard JSON config
```json
{
  "sfxDir": "./assets/sfx/"
}
```

**Pipeline 3 Selection** (`engine/pipeline3/sfxSelection.js`):
- `listSfxFiles(sfxDir)` — scans directory for `.mp3`, `.wav`, `.ogg`, `.m4a` files
- `selectSfxForScenes(masterSeed, scenes, sfxFiles)` — picks one SFX per scene using seeded RNG (derived per-scene: `deriveRng(masterSeed, "sfx", sceneId)`), so adding/removing scenes doesn't reshuffle other scenes' choices
- SFX placed at `scene.timing.endSec` (end of each scene)

**Remotion Render** (`engine/pipeline3/StoryboardVideo.jsx` lines 98-102):
```jsx
{sfx.map((s) => (
  <Sequence key={`sfx-${s.sceneId}`} from={Math.round(s.atSec * fps)}>
    <Audio src={resolveAudioSrc(s.sfxPath)} />
  </Sequence>
))}
```

---

## Music (Background Track)

**Source Configuration:** `storyboard.music` — specified in storyboard JSON config
```json
{
  "music": { "path": "./assets/music/background.mp3", "volume": 0.15 }
}
```

**Remotion Render** (`engine/pipeline3/StoryboardVideo.jsx` line 95):
```jsx
{music && <Audio src={resolveAudioSrc(music.path)} volume={music.volume ?? 0.25} loop />}
```

---

## Path Resolution

**`resolveAudioSrc()`** (`StoryboardVideo.jsx` lines 107-112):
- Absolute paths (`/...`) or URLs (`http://...`) used as-is
- Relative paths resolved via Remotion's `staticFile()` (public folder convention)

---

## Example Storyboard Config

```json
{
  "id": "my-video",
  "seed": "seed-123",
  "voice": { "provider": "kyutai", "voiceId": "narrator" },
  "sfxDir": "./assets/sfx",
  "music": { "path": "./assets/music/ambient.mp3", "volume": 0.15 },
  "scenes": [...]
}
```

Place `.mp3`/`.wav` files in:
- `./assets/sfx/` — any number, one picked per scene
- `./assets/music/ambient.mp3` — background music track