# Colour of new plants by their distance from the letter's middle

## Context
The text-line fit (`Garden.fitTextLines()`) knows each letter's **aligned middle**, the point where it can be read. The journal (2026-10-14 / 10-23) asks whether colour alone can help readability, without pushing growth. This adds that:

- When a plant is **born by spreading** (seeding), it looks at how far its spot is from its letter's aligned middle, and gets its **lightness and chroma** from that distance. Near the middle it is lighter and less vivid; far away it is darker.
- The colour is decided **once at birth and never changes** while the plant grows.
- The hue stays as it is (inherited with mutation).
- The distances are **the same for all lineages**, in absolute pixels, independent of how far a lineage has spread.

## The curve: one S-curve (logistic)

```
 lightness / chroma
   NEAR ┤━━━━━━━━━━━━━━╮
        │                ╲            ← one smooth formula, no separate zones
    FAR ┤                 ╰━━━━━━━━━━━━━━━━━
        └────────────────┬─────────────────────→ distance from the aligned middle (px on the ground)
          near (1–3)   4–5 (the bend)   far (6–10)
                    COLOR_MID_DIST
```

```
s = 1 / (1 + exp(−(d − COLOR_MID_DIST) / COLOR_SOFTNESS))   // 0 = near, 1 = far; 0.5 exactly at COLOR_MID_DIST
lightness = lerp(NEAR_LIGHTNESS, FAR_LIGHTNESS, s)
chroma    = lerp(NEAR_CHROMA,    FAR_CHROMA,    s)
```
- `COLOR_MID_DIST` is **where** the change happens.
- `COLOR_SOFTNESS` is **how sharp** the bend is: small gives almost a hard step, large gives a gentle slope. The transition covers about `COLOR_MID_DIST ± 2 × COLOR_SOFTNESS`.

`d` is measured with the existing `ellipticalDist()` ([js/helpers.js](js/helpers.js)), which is the distance on the ground. It's the same measure as spreading and the tool circle, so up and down count the same as left and right.

## Settings ([js/config.js](js/config.js), "drawing" section)
`PLANT_LIGHTNESS` / `PLANT_CHROMA` are replaced by:
```js
var NEAR_LIGHTNESS = 0.78; // plants born near their letter's middle: lighter, less vivid
var NEAR_CHROMA = 0.11;
var FAR_LIGHTNESS = 0.55;  // plants born far from it: darker
var FAR_CHROMA = 0.15;
var COLOR_MID_DIST = 120;  // px on the ground; where the colour turns from NEAR to FAR (the middle of the S-curve)
var COLOR_SOFTNESS = 15;   // px; how sharp the turn is: small = almost a step, large = gentle
```
These are starting values to tweak. With them, up to about 90 px is NEAR, the bend is around 90–150 px, and beyond that is FAR. That matches your 1–3 / 4–5 / 6–10.

## Changes

**[js/CharPlant.js](js/CharPlant.js)**
- Replace `setHue(h)` with `setColor(h, l, c)`. It stores `hue`, `lightness` and `chroma`, and caches `cStr` from them.
- The constructor gets `NEAR_LIGHTNESS` / `NEAR_CHROMA` by default. That covers the planted text and rare sprouts of extinct letters, which come back at their home in the text, so they count as "near".
- `serialize()` / `charPlantFromSerialized()` also save `l` and `c`. Saves without them get the NEAR values.
- The fruit outline lerps from the plant's **own** `lightness` / `chroma` instead of the constants.
- `plantSpread()` (the seeding, also used by `sproutNear()` for rare sprouts of living letters) and `plantSuccessor()` call `garden.colorByDistance(child)` before `garden.addPlant(child)`.

**[js/Garden.js](js/Garden.js)**
- New `colorByDistance(plant)` applies the curve above. It finds the aligned middle of the plant's lineage; if there is none (an extinct lineage), it keeps the NEAR colour.
- New `alignedMiddleOf(lineage)` looks the lineage up in a fit cached **per tick**. `update()` resets `this.fitCache = null` at its start, and the fit is computed lazily on the first birth of that tick. So there's at most one `fitTextLines()` per tick, and none in ticks without births.
- In debug, the "text line (fitted)" layer gets one faint ellipse around each aligned middle at `COLOR_MID_DIST`, where the colour turns, so you can see it while tuning.

**[js/Lineage.js](js/Lineage.js)**: `color()` (debug) uses `NEAR_LIGHTNESS` / `NEAR_CHROMA` instead of the removed constants.

## Verification
- `node --check` passes on all JS files. A small node test of the curve checks the values at d = 0, 60, 120, 180 and 300 (≈NEAR, ≈NEAR, exactly halfway, ≈FAR, ≈FAR).
- In the browser, set the speed to about 50x. Newly seeded plants close to their letter come out lighter, and those far away come out darker. Their colour doesn't change while they grow.
- In debug, the turn ellipse is visible around each ring.
- Reload the page: saved plants keep their colours.
- The console shows no errors.

## Afterwards
Copy this approved plan to `plans/YYYYMMDD_hhmm_colour-of-new-plants-by-their-distance-from-the-letter-s-mi.md` (per [claude.md](claude.md)).
