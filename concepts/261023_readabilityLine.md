# Readability line ("middle-ing")

How the garden works out a clear (?) readability line, by finding the "middle" of each lineage (the spread of a character). The idea is to later use this in some way to improve the readability of the text (in an as sublte way as possible). For now this is debug-only.

The code is in `Garden.fitTextLines()` and `Garden.orderAlignedMiddles()` ([js/Garden.js](../js/Garden.js)), with helpers in `Lineage` ([js/Lineage.js](../js/Lineage.js)) and [js/helpers.js](../js/helpers.js).

## Overview

| Step | What | Result |
|---|---|---|
| 1 | Group lineages into text lines | one group per written line |
| 2 | Area of each lineage | convex hull around its living plants |
| 3 | Middle of each area | centroid of the hull |
| 4 | Fit the original line to the garden | `scale` (spacing), `shiftX`, `lineY` |
| 5 | Target for each letter | where it *should* be on the fitted line |
| 6 | Pull each letter towards its target | first aligned middle, per letter |
| 7 | Restore letter order | final aligned middle (or `orderBroken`) |

All of this runs every frame, but only while debug is on.

---

## 1. Lineages and text lines

Every letter of the original text is a **lineage**. Each lineage remembers its **origin**, the spot where the letter was first planted (`originX`, `originY`), and its living plants (`members`). Lineages are created in text order. Consecutive lineages with the same `originY` and size belong to one text line.

The origins of a line are a perfect template: straight, in order, evenly spaced.

```
   G    a    r    d    e    n          ← origins (debug: crosses with a count)
   x    x    x    x    x    x
```

## 2. Area: the hull

A lineage's **area** is the convex hull around all its living plants (`Lineage.hull()`). With fewer than 3 plants it's just their positions: a point or a segment. Extinct lineages have no area and are skipped.

## 3. Middle: the centroid

The **middle** of an area is the hull's centroid, its centre of mass (`Lineage.middle()`).

After a while the middles can be a mess:

```
  ┌────────────┐                  ← G has sprawled far to the left
  │      ●     │  ┌──┐
  └────────────┘  │● │  ┌───┐       ┌──┐
                  └──┘  │ ● │  ┌────┼─┐│
                        └───┘  │  ● │●││  ← d and e overlap; d's middle is right of e's
                               └────┼─┘│
                                    └──┘
           G       a     r      e  d     ← reading the middles gives "Gared"
```

## 4. Fitting the original line to the garden

Instead of fixing each letter separately, the whole original line is moved and stretched to fit the current garden. Each fit uses the **median** instead of an average, so a single wild lineage (like the sprawling G) can't pull the line.

**Spacing (`scale`).** The garden spreads out over time, so the letters end up further apart than written. For **every pair** of letters, compare how far apart their middles are now with how far apart their origins were:

```
   factor(i, j) = (middle_j.x − middle_i.x) / (origin_j.x − origin_i.x)

   scale = median of all factors   (at least DEBUG_FIT_SCALE_MIN = 1)
```

A sprawling outer letter only affects the pairs it's part of, so the median ignores it. A simple average of the distances (`(last − first) / count`) would depend entirely on the two outer letters. Swapped letters give negative factors, and the minimum of 1 keeps them from shrinking the line.

**Position (`shiftX`, `lineY`).**

```
   shiftX = median of (middle.x − origin.x × scale)
   shiftY = median of (middle.y − origin.y)
   lineY  = originY + shiftY            ← the line always stays horizontal
```

## 5. Targets

Each letter's **target** is where it would be on the fitted line:

```
   target = (origin.x × scale + shiftX,  lineY)

   origins:  G  a  r  d  e  n
               ↘  ↘  ↘  ↘  ↘  ↘          (stretched by scale, moved by shift)
   targets:     G'   a'   r'   d'   e'   n'   ← straight, ordered, evenly spaced
```

The targets are always perfect. Debug shows them as small crosses on the dashed line, and the `×1.8` label at its end is the `scale`.

## 6. Pulling each letter towards its target

A letter can only "be" where its plants are, so its point has to stay inside its area (`Lineage.closestPoint()`):

- **Target inside the area:** the aligned middle *is* the target. The area reaches the line there.
- **Target outside the area:** find the edge point of the area nearest to the target, then move from the middle `DEBUG_ALIGN_EDGE_FACTOR` (0.9) of the way towards it. That keeps the point slightly inside the area.

```
  ┌────────────┐
  │          ◎ │  ┌──┐                   ← G's point stays at its right edge,
  └────────────┘  │◎ │  ┌───┐       ┌──┐   close to where G belongs
                  └──┘  │ ◎ │  ┌────┼─┐│
                        └───┘  │ ◎  │◎││  ← d left, e right: order restored inside the overlap
                               └────┼─┘│
                                    └──┘
                ◎─────◎─────◎─────◎───◎───◎   ← reads "Garden" again
```

## 7. Restoring the letter order

Step 6 handles each letter **on its own**, so neighbours can still end up in the wrong order. Example with "Text": e has a tiny area at the top right, while x has a big area that also reaches below and to the right of e. x's point nearest its target is in the upper-left part of x's area, which is left of e:

```
                       ┌─e─┐
       ┌───────────────┤ ◎ ├──┐
       │  ◎ ← x        └───┘  │     x's first point is left of e: "Txet"
       │                      │
       └──────────────────────┘

                    ↓ order pass

                       ┌─e─┐
       ┌───────────────┤ ◎ ├──┐
       │               └───┘  │
       │                    ◎ │ ← x moved into the part of its area right of e: "Text"
       └──────────────────────┘
```

`orderAlignedMiddles()` goes through each pair of neighbours `(a, b)`. If `b` isn't at least `gap` to the right of `a` (`gap = DEBUG_ORDER_GAP_FACTOR × letter size`), it tries two moves:

- **Move b right:** cut b's area down to the part right of `a + gap` (`clipHullX()`), then take its point nearest b's target.
- **Move a left:** cut a's area down to the part left of `b − gap`, then take its point nearest a's target.

Whichever move is possible and shorter wins. Fixing one pair can break the next one, so the pass repeats until nothing changes (at most once per letter).

If neither move is possible, one area lies completely on the wrong side. The letter is then marked `orderBroken`, and its ring is drawn in red. The text really is broken there, and it shouldn't be hidden.

---

## Reading the debug view

| What you see | Meaning |
|---|---|
| coloured outline | a lineage's area (hull) |
| small filled dot, grey line | area middles, connected in text order |
| dashed line + `×scale` | the fitted text line and its spacing factor |
| small cross | a letter's target on that line |
| ring + connector from the dot | the aligned middle and how far it moved |
| light line through the rings | the text as it can be read now |
| red ring | out of order, and its area can't fix that |

## Settings ([js/config.js](../js/config.js), debug section)

| Setting | Default | Effect |
|---|---|---|
| `DEBUG_FIT_SCALE_MIN` | 1 | the fitted spacing never gets narrower than the original |
| `DEBUG_ALIGN_EDGE_FACTOR` | 0.9 | how far towards the edge a letter moves if its target is outside its area |
| `DEBUG_ORDER_GAP_FACTOR` | 0.25 | minimum horizontal gap between neighbours, × the letter's size |

## Ideas for later

- **Readability score per letter:** the distance from aligned middle to target, plus `orderBroken`. It could drive colour (more saturated or brighter when a letter keeps the line), or let plants seed towards their target to rebuild the text.
