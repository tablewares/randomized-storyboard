# Translating a DESIGN.md spec into a template's `style` surface

The `randomized-storyboard-make-template` skill's `variations[].style` field is
a `StandardStyleVars` object with a fixed-shape `palette` + `font` + `spacing` +
`radius`. A Google DESIGN.md (see the `design-md` skill) carries a much richer
token set (`colors.*`, `typography.*`, `rounded.*`, `spacing.*`, `components.*`).
This is the established mapping from the Anthropic `designmd/claude/DESIGN.md`
to the template `style` surface — reusable for any future branded template
authored against a DESIGN.md in this repo.

## Palette mapping (DESIGN.md `colors` → `style.palette`)

The `StandardStyleVars.palette` exposes six named slots:
`background`, `foreground`, `primary`, `secondary`, `accent`, `muted`. Pick the
DESIGN.md colors that fill each slot based on the *surface mode* the variation
renders on, not the brand color name:

| `style.palette` slot | DESIGN.md Anthropic key (cream surface) | DESIGN.md Anthropic key (dark surface) |
|---|---|---|
| `background` | `colors.canvas` #faf9f5 | `colors.surface-dark` #181715 |
| `foreground` | `colors.ink` #141413 | `colors.on-dark` #faf9f5 |
| `accent`     | `colors.primary` #cc785c (coral) | `colors.primary` #cc785c (coral — the CTA color is constant) |
| `muted`      | `colors.muted` #6c6a64 | `colors.on-dark-soft` #a09d96 |
| `primary`¹   | `colors.surface-card` #efe9de (feature-card bg) | `colors.surface-dark-elevated` #252320 (card bg on dark) OR `colors.surface-dark` #181715 (featured-tier bg) |
| `secondary`  | `colors.surface-soft` #f5f0e8 (rarely used) | `colors.surface-dark-soft` #1f1e1b (code-block inner bg) |

¹ `style.palette.primary` is the generic "secondary surface" slot in this
engine's templates (feature-card fill, pricing-tier fill, etc.) — it is NOT the
brand's primary action color. That role belongs to `accent`. Read existing
templates' use of `palette.primary` before assigning it; e.g. `stat/grid` uses
`palette.muted` for borders and `palette.accent` for the stat number.

## Font mapping (DESIGN.md `typography` → `style.font`)

`StandardStyleVars.font` has `heading`, `body`, `scale`. Map the brand's display +
body fonts:

| `style.font` slot | DESIGN.md Anthropic value |
|---|---|
| `heading` | `typography.display-xl.fontFamily` — Copernicus / Tiempos Headline. **Open-source substitute:** `"Cormorant Garamond, Tiempos Headline, serif"` (per DESIGN.md typography note) |
| `body`    | `typography.body-md.fontFamily` — StyreneB. **Substitute:** `"Inter, sans-serif"` |
| `scale`   | `1` (alter for bigger headline emphasis; DESIGN.md display sizes are already large) |

The split is unbreakable per DESIGN.md "Do's": serif for display headlines,
humanist sans for body + UI labels. Never use Inter for a display headline on an
Anthropic-branded template; the serif character is the brand voice.

## Component → structure mapping (which DESIGN.md components map to which template shape)

This is the most useful distillation — when the user says "make templates from
this DESIGN.md", translate DESIGN.md components into template families:

| DESIGN.md component | Template family fit | Notes |
|---|---|---|
| `feature-card` + feature-card-grid | `brand/anthropic-feature-grid` (3-up) | background = `surface-card`, rounded 12px, padding 32px. Coral accent rule on top. |
| `product-mockup-card-dark` | (dark variation of feature-grid) | background = `surface-dark`, text inverts to `on-dark`. Pairs with the cream variation as a cream→dark band alternation. |
| `code-window-card` | `brand/anthropic-code-window` | background = `surface-dark`, inner code block = `surface-dark-soft`, JetBrains Mono 14px (or scaled 22-24px for video), line numbers in `muted-soft`. |
| `callout-card-coral` / `cta-band-coral` | `brand/anthropic-cta-coral` (coral variation) | full-bleed coral fill, `on-primary` text, display-sm serif headline, uppercase tracked eyebrow label. |
| `cta-band-dark` | (dark variation of cta-coral) | background = `surface-dark`, `on-dark` text, coral accent label. |
| `pricing-tier-card` + `pricing-tier-card-featured` | `brand/anthropic-pricing` (cream + featured-dark) | canvas cards with hairline border; featured tier flips to `surface-dark` (the dark surface IS the featured-tier signal). Price in serif `display-sm`. |
| editorial pull-quote (not a formal DESIGN.md component but implied by the serif voice) | `brand/anthropic-quote` (cream + dark) | oversized serif opening mark, coral accent rule above, uppercase tracked attribution. |
| `badge-pill`, `badge-coral`, `connector-tile`, `category-tab` | fold into larger templates, not standalone | These are small UI atoms — don't make one-badge templates. Use the accent rule / pill as a decorative element inside a feature-grid or quote. |

## DESIGN.md "Do's and Don'ts" that constrain template structure

From the DESIGN.md body, these are load-bearing for Anthropic-branded templates:

- **Cream canvas is the brand** — never use pure white (`#fff`) or cool gray as
  `palette.background` on a cream-surface variation. Use `colors.canvas` #faf9f5.
- **Coral is scarce on individual elements, generous on full-bleed cards.** A
  small coral accent rule or bullet is right; a coral button on a cream card
  belongs only on the `cta-coral` template. Don't paint feature-card backgrounds
  coral.
- **Cream → dark band alternation is the pacing mechanism.** A feature-grid
  cream variation followed by a feature-grid dark (or code-window dark)
  variation is the brand's rhythm. Encourage it by always authoring a cream +
  dark variant pair for new brand templates when the DESIGN.md has both surface
  modes.
- **Serif display weight is 400, never bold.** Copernicus at 700 reads as
  bombastic. Set `fontWeight: 400` on every serif headline in the structure jsx.
- **The dark surface IS the elevation signal — no shadows.** Don't add
  `boxShadow` to cream or dark cards. The cream-vs-dark contrast is the depth.

## Token-reference caveat

DESIGN.md uses `{colors.primary}` token references in its YAML front matter. The
template `style` object does NOT support token references — it wants literal hex
strings. When authoring a manifest's `variations[].style.palette`, inline the hex
values from the DESIGN.md `colors:` section directly. The skill's manifest JSON
is read by `discoverTemplates()` and never token-resolved.

## See also

- `designmd/claude/DESIGN.md` in the repo root — the source spec this mapping
  derives from.
- The `design-md` skill — for authoring / linting the DESIGN.md itself.
- `templates/brand/anthropic-statement/` — the first Anthropic-branded template
  in this repo (cream + coral, serif headlines), authored before this mapping
  was written down. The 5 templates added 2025-07-25 (feature-grid, code-window,
  cta-coral, pricing, quote) apply this mapping to cover the rest of the
  DESIGN.md's component set.
