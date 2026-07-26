# Koisei Design System
**Style name:** Quiet-Luxury Japanese Travel Editorial — "Cinematic Washi"
A high-end, scroll-driven storytelling style for luxury travel / cultural-journey brands. Reads like a printed woodblock travel poster brought to life: warm paper tones, one vermilion accent, oversized serif display type, and slow, deliberate motion.

---

## 1. Design Philosophy

- **Paper, not screen.** Backgrounds are warm off-whites (washi paper), never pure white or pure black. Everything feels printed, aged, tactile.
- **One accent, used sparingly.** A single vermilion red (`#C4472F`) is the only saturated color — a small dot, a hover underline, one button. Everything else is ink, cream, and muted sand.
- **Editorial, not corporate.** Huge italic serif headlines, thin kickers in tracked-out uppercase, Japanese characters as texture/atmosphere rather than translation.
- **Slow reveal.** Content enters line-by-line on scroll (masked/clipped, not fading text blocks). Motion is unhurried — 400–900ms eases, not snappy UI transitions.
- **Day → night arc.** The page itself has a narrative journey (light paper sections dissolve into deep night/lantern sections), mirroring the story being told.

---

## 2. Color Palette

Define as CSS custom properties on `<body>` so every section can reference them.

```css
:root{
  /* paper / light */
  --washi:       #F1E9DE;  /* primary background */
  --washi-warm:  #ECE4D9;  /* secondary panel bg */
  --washi-deep:  #E4DED5;  /* recessed / card bg */
  --sand:        #E9D4BD;  /* warm mid tone */
  --river-stone: #C1BBB2;  /* muted neutral / dividers */

  /* ink */
  --ink:         #251C16;  /* primary text on light */
  --cream:       #EDE9DF;  /* primary text on dark */

  /* night */
  --night:       #241B15;  /* dark section background */
  --night-deep:  #1A130E;  /* deepest / video vignette */

  /* accent */
  --vermilion:   #C4472F;  /* CTA, selection, hover underline, dot markers */
  --lantern:     #E8A54B;  /* warm secondary accent (quotes, night glow) */

  /* florals (used very sparingly — decorative only) */
  --sakura:       #E8B4C0;
  --sakura-deep:  #D98E9F;
}

body{ background: var(--washi); color: var(--ink); }
::selection{ background: var(--vermilion); color: var(--washi); }
```

**Opacity conventions** (apply against `--ink` on light sections, `--cream` on dark):
| Use | Value |
|---|---|
| Body copy on light | `rgba(37,28,22,.78)` |
| Secondary / caption text | `rgba(37,28,22,.55)` to `.65` |
| Hairline dividers on light | `rgba(37,28,22,.15)` to `.2` |
| Body copy on dark | `rgba(237,233,223,.85)` |
| Secondary text on dark | `rgba(237,233,223,.5)` to `.65` |
| Hairline dividers on dark | `rgba(237,233,223,.25)` to `.35` |

Never use flat black or flat white — always the ink/cream tokens above.

---

## 3. Typography

**Fonts (Google Fonts):**
```
Cormorant Garamond:ital,wght@0,400;0,500;1,400;1,500   → display serif
Space Grotesk:wght@400;500                              → body/UI sans
Noto Serif JP:wght@400                                  → Japanese accent glyphs
```

| Role | Font | Notes |
|---|---|---|
| Body / nav / UI | Space Grotesk | Default on `<body>`. Clean geometric sans, keeps the serif headlines feeling special by contrast. |
| Display headlines (h1/h2/h3) | Cormorant Garamond | Always paired with generous negative letter-spacing (`-.015em`) at huge sizes, and `<em>` for italic emphasis mid-headline (e.g. "Where Petals **Drift** Downstream"). Weight 400–500 only, never bold. |
| Japanese accent characters | Noto Serif JP | Used for a single word/phrase (brand mark, vertical sidebar text, pull-quote glyphs) — atmosphere, not primary content. |

**Scale (use `clamp()` for everything so it's fluid, never fixed px):**
```css
--h1: clamp(4rem, 11vw, 11.5rem);      /* hero, line-height .95 */
--h2: clamp(2.6rem, 5.6vw, 6.2rem);    /* section titles, line-height 1.05–1.1 */
--h3: clamp(1.8rem, 3vw, 3.5rem);      /* sub-headers / film captions */
--stat: clamp(2.5rem, 5vw, 4.5rem);    /* big numbers */
--body: clamp(1rem, 1.15vw, 1.185rem);
```

**Micro-copy pattern (kickers/labels):** always uppercase, always widely tracked, always small.
```css
.kicker{ font-size:.75rem; text-transform:uppercase; letter-spacing:.32em; }
.nav-label{ font-size:.75rem; letter-spacing:.12em; }
.overline-tight{ letter-spacing:.2em; } /* section counters, timestamps */
```
A kicker is almost always preceded by an em-dash and a small vermilion square:
```html
<p class="kicker flex items-center gap-3">
  <span class="inline-block w-1.5 h-1.5" style="background:var(--vermilion)"></span>
  — 01 · The Philosophy
</p>
```

**Headline construction rules:**
- Wrap each visual line in `overflow-hidden` + an inner `block` span so it can be masked and slid up on scroll.
- Use `<em>` for one emphasized word/phrase per headline (renders in italic Cormorant).
- Add `text-shadow: 0 2px 30–40px rgba(26,19,14,.35–.6)` when headline sits over an image/video for legibility.

---

## 4. Layout & Structure

- **Full-bleed, section-based storytelling.** Each `<section>` is a "chapter" (`h-screen` or generous vertical padding like `16vh 0`), stacked vertically: Hero → Manifesto → Scroll-film → Horizontal gallery → Day-to-night transition → Second scroll-film → Footer/CTA.
- **Content container:** `max-width: 1400px` (or 1600px for wide galleries), horizontal padding `px-6` mobile / `px-12` desktop.
- **Rounded chapter breaks:** sections transitioning from the hero use `rounded-t-[32px]` to visually "lift" the next paper layer over the previous one.
- **Section index rail:** a fixed vertical progress rail on desktop (`left-6`, `1px` wide, vermilion fill tracks scroll progress) + a small "01 / 07" vertical label (`writing-mode: vertical-rl`).
- **Numbered story counters:** big ghost numerals (outline-only text, `-webkit-text-stroke:1px var(--ink); color:transparent`) label gallery cards, filling in with solid ink as they become active.
- **Horizontal scroll galleries:** cards pinned and dragged sideways via scroll (GSAP ScrollTrigger horizontal scrub), each card = full-bleed image + numeral + serif title + one-line caption + text link.
- **Full-screen video "film" chapters:** background video, dark vignette (`box-shadow: inset 0 0 18vmin rgba(26,19,14,.75)`), 2–3 rotating caption/quote overlays, thin progress bar + timecode at the bottom.
- **Stat pairs:** two-column grid, huge serif number + small uppercase tracked label underneath.
- **CTA close:** headline + a circular vermilion "magnet" button (120×120px, follows cursor slightly on desktop) that says "Begin →".
- **Footer:** paper background, 4-column link grid with uppercase tracked-out category labels.

---

## 5. Components

**Nav bar**
- Fixed, transparent over hero, `height:88px`.
- On scroll: shrinks to `68px`, gains `background: rgba(241,233,222,.82)` + `backdrop-filter: blur(12px)`.
- Over a dark/video section: inverts to `rgba(36,27,21,.82)` background with cream text (`.nav--night` variant).
- Links use the shared underline hover (`.u-link`, below). One nav item is a plain Japanese character (旅) as a decorative divider. CTA is a pill button: `rounded-full`, `1px` ink border, inverts to filled ink/cream on hover.

**Underline link hover**
```css
.u-link{ position:relative; }
.u-link::after{
  content:''; position:absolute; left:0; bottom:-3px;
  width:100%; height:1px; background:var(--vermilion);
  transform:scaleX(0); transform-origin:left;
  transition:transform .35s cubic-bezier(.22,1,.36,1);
}
.u-link:hover::after{ transform:scaleX(1); }
```

**Buttons**
- Primary: filled vermilion circle or pill, cream text, small uppercase label + icon.
- Secondary/nav: outline pill (`1px solid rgba(ink,.4)`), inverts fill on hover.
- No drop shadows, no gradients on buttons — flat color only.

**Scroll cue:** small "SCROLL" label + thin vertical line with a dot that animates down and fades (`@keyframes scrollDot`).

**Grain overlay:** a full-viewport `<canvas>` at low opacity (`~.05`) with `mix-blend-mode: overlay`, fixed above all content — gives the whole page a subtle film-grain texture.

**Custom cursor (desktop only):** small solid dot + a larger ring that follows with lag, both `mix-blend-mode: difference` so they invert over any background.

**Preloader:** centered wordmark in Cormorant Garamond with huge letter-spacing (`.5em`), a thin progress line filling left-to-right, percentage counter below.

---

## 6. Motion Principles

- Respect `prefers-reduced-motion` — disable all animation/transition globally when set.
- Line-by-line headline reveals: mask (`overflow:hidden`) + translateY, staggered ~60–100ms per line, eased with `cubic-bezier(.22,1,.36,1)`.
- Section/nav transitions: 400–500ms, same ease — nothing feels instant or bouncy.
- Counters count up numerically on scroll-into-view (e.g. distance, seasons).
- Ghost numerals and gallery images shift from muted/scaled to sharp/settled as a card becomes active (image `transform: scale(1.15) → 1`, numeral outline → filled).
- Ambient looping motion only where it reinforces the theme (drifting petals in a WebGL layer behind the hero, the pulsing scroll dot) — never anything jittery or attention-grabbing.

---

## 7. Voice & Content Pattern

- Section labels: `— 01 · The Philosophy`, `— 02 · Stations`, `— Begin Your Journey` — always a numeral, a middle-dot, a short evocative noun.
- Headlines are short, poetic, present-tense fragments with one italicized word: *"Come see the river **bloom**"*, *"Three **stations**, one current."*
- Body copy is brief (2–3 sentences max per block), literary in tone, never salesy or feature-listy.
- A single native-language phrase (with translation nearby or implied) reinforces authenticity without over-explaining — e.g. a two-character word used as the brand's quiet subtitle.

---

## 8. Applying This System Elsewhere

When building a new page/section in this style:
1. Set the palette as CSS variables on the root/body first — never hardcode hex values inline elsewhere.
2. Pick **one** accent color role (vermilion here) and use it in no more than 2–3 places per screen.
3. Every headline: Cormorant Garamond, tight negative tracking, one `<em>` emphasis, masked scroll-reveal.
4. Every kicker/label: uppercase, `.2em`–`.32em` letter-spacing, tiny size, paired with a small accent-colored square or dash.
5. Keep body copy narrow (`max-width: ~34–62ch`) and sparse — this style trusts whitespace and imagery over paragraphs.
6. Add at least one "slow" full-bleed moment (video, horizontal scroll, or day/night dissolve) — the format is built around a small number of cinematic beats, not dense information density.
