# Rare sprouts return home (between their neighbours)

## Context
The text-line fit (`Garden.fitTextLines()`, see [concepts/261023_readabilityLine.md](concepts/261023_readabilityLine.md)) knows each living letter's **aligned middle**, which is where it can currently be read. So far only debug uses it.

The journal (2026-10-23) wants to avoid "artificially pushing the growth". This is the smallest use: it only affects letters that have **died out**. Today an extinct lineage re-sprouts (rarely) around its last seen plant (`sproutRare()` → `sproutNear(lineage.lastSeen, true)`), which may be anywhere by now. That behaviour is **replaced**: an extinct letter re-sprouts in the gap it left in the text. For "Ga den", the r comes back halfway between a and d.

```
        ◎a                ◎d
             ↘          ↙
                 r              ← new plant, halfway between the aligned middles of a and d
```

## Rule: `homeOf(lineage)` for an extinct lineage
On its text line (from `fitTextLines()`), let A = the nearest *living* letter before it, and B = the nearest *living* letter after it.
- **Both exist:** `t = (origin − A.origin) / (B.origin − A.origin)` (using `originX`), and `home = A.aligned + t × (B.aligned − A.aligned)`.
  - With one missing letter, `t = 0.5`, exactly the midpoint.
  - With several missing letters in a row, they spread evenly in the gap.
- **Only one exists** (first or last letter extinct):
  - x: one fitted spacing step beyond that neighbour, `N.aligned.x + (origin − N.origin) × line.scale`.
  - y: the **average y of all living letters' aligned middles** on that line, not the neighbour's y. That way the letter joins the text's overall height, instead of continuing a local tilt.
- **None** (the whole line extinct, so no fit): the position of its last seen plant (`lastSeen.x`, `lastSeen.y`).

`lastSeen` also provides the genes (hue, size, grow duration) via `makeChild()`, and the debug color.

## Changes

**[js/Garden.js](js/Garden.js)**
- New `homeOf(lineage)`, about 20 lines, implementing the rule above:
  - Calls `fitTextLines()`. Only extinct re-sprouts call it, and those are rare, so it's cheap.
  - Finds the line whose entries share the lineage's `originY` and `baseSize` (the same rule the fit uses for grouping).
  - `fitTextLines()` itself is unchanged.
- `sproutRare()`:
  - For an extinct lineage with `lastSeen`: `var home = this.homeOf(lineage); this.addPlant(lineage.lastSeen.makeChild(home.x, home.y));`. That's a direct plant with no space check, just as extinct letters are already force-planted today.
  - For a living lineage: `this.sproutNear(random(lineage.members))`, as before.
- `sproutNear(parent, force)`: remove `force` and its fallback branch. It's now only used for living lineages, which never force.
- Update the comments of `sproutRare` / `sproutNear` ("an extinct lineage sprouts again near its last seen plant" becomes "…in its gap in the text").

**[js/config.js](js/config.js)**: update the `RARE_SPROUT_CHANCE` comment if it mentions the position. There's no new setting.

The `concepts/` folder is not touched.

## Verification
- `node --check` passes on all JS files.
- In the browser, press D (debug), turn on "text line (fitted)", and set the speed to about 50x.
  - Cut all plants of a middle letter (the r of "Garden"): it re-sprouts on the line between a's and d's rings.
  - Cut the first letter (G): it re-sprouts left of a, about one letter spacing away, at the line's average height.
  - Cut a whole line: its letters re-sprout at their last seen spots.
- The console shows no errors.

## Afterwards
Copy this approved plan to `plans/YYYYMMDD_hhmm_rare-sprouts-return-home-between-their-neighbours.md` (per [claude.md](claude.md)).
