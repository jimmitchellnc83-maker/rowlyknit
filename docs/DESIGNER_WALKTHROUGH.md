# Pattern Designer — Plain-English Walkthrough

This is a narrative walkthrough of Rowly's Pattern Designer, written for people who knit and don't read code. The goal is to describe what the tool does today so the workflow can be tested against how knitters actually plan garments — in their own communities, against tools like KnitMachine Pro, and against your own design process.

Read it in order; each section builds on the previous one.

---

## What it is

The Designer is a parametric garment builder. You enter your **gauge** and your **finished measurements**, pick a garment shape, and Rowly turns those numbers into:

1. A **schematic** (a labeled outline of the garment with measurements and stitch counts).
2. A **stitch-by-stitch chart** you can draw colorwork or texture into, which renders right on top of the schematic.
3. **Row-by-row instructions** in plain knitter vocabulary ("CO 88 sts. Work 12 rows in k1p1 rib. Inc 1 st each side every 6th row × 7…").
4. A **print view** suitable for taking off-screen, plus a **Save to Library** button that drops the result into your pattern collection as a real Rowly pattern (so you can track it row-by-row like any imported pattern).

It's not a stitch-pattern repository or a chart-only tool. It's "I want a sweater that fits my chest at this gauge" → "here are the numbers."

---

## How you get to it

There's one entry point: the **Designer** link in the main sidebar (route: `/designer`). It's auth-only — the draft persists per-account in the browser so you can leave and come back without losing your work.

There is no hand-off into the Designer from elsewhere yet — calculators don't deep-link in, project pages don't open it. Closing the tab and reopening `/designer` brings back exactly what you were last working on.

---

## What you give it

The Designer always wants three things up top:

- **Gauge** — stitches and rows over a measurement (default 20 sts × 28 rows over 4 in, but you can change all three numbers).
- **Item type** — sweater, hat, scarf, blanket, shawl, mittens, socks, or **custom**.
- **Measurements specific to that item type** — chest + length for sweaters, head circumference for hats, foot length for socks, etc.

Every numeric field has a sensible default (chest 36 in, ease 4 in, sleeve length 18 in, etc.) so you can land on the page, pick "sweater," and see a usable schematic immediately. From there you change numbers and the schematic updates live.

Optional inputs that unlock more shaping:
- **Waist shaping** (sweater) — adds dec/inc through the body.
- **Set-in armhole + sleeve cap** (sweater) — switches from drop-shoulder to set-in construction; recalculates both the body panel and the sleeve.
- **Front vs. back panel** — a "front" sweater body draws the neckline shaping; a "back" body leaves a straight shoulder seam.

---

## The eight garment shapes

Each item type has its own schematic renderer with its own parameters. They are:

| Shape | Parameters | Output |
|---|---|---|
| **Sweater body** (Body) | Chest, ease, total length, hem depth, waist shaping (optional), armhole + neckline (optional) | Front/back panel with hem, waist, armhole, neckline shaping rows |
| **Sleeve** | Cuff circumference + ease, bicep + ease, cuff-to-underarm length, cuff depth, optional cap | Tapered tube, optionally with a set-in cap matching the body's armhole |
| **Hat** | Head circumference, negative ease at brim, total height, brim depth, crown height | Tube + crown decreases |
| **Mitten** | Hand + thumb circumference, cuff ease + depth, cuff-to-thumb / thumb-gusset / thumb-to-tip lengths | Thumb-gusset construction |
| **Sock** | Ankle + foot circumference, cuff ease + depth, leg length, foot length | Top-down sock with cuff + heel + foot regions |
| **Shawl** | Wingspan, initial cast-on stitches | Triangle (top-down increases) |
| **Rectangle** | Width + length + optional border depth | Used for scarves and blankets |
| **Custom Draft** | Stack of named "sections" (see below) | Free-form silhouette built section by section |

Each schematic is an SVG with measurement labels and stitch-count callouts at key seams. They scale with a zoom control (1× / 1.5× / 2× / 3×) for screen comfort, and they tint with your chosen main color so a navy sweater previews navy.

---

## Custom Draft: when none of the presets fit

Custom Draft is the escape hatch. You describe your garment as a **vertical stack of sections**, each one a small recipe:

- **Straight** — knit N rows even at the current stitch count.
- **Ribbing** — knit N rows even (rendered as ribbing in the schematic for visual cue).
- **Increase** — over N rows, change the stitch count by ±X stitches per side.
- **Decrease** — same idea, opposite direction.
- **Cast off each side** — bind off X stitches at each edge over N rows (used for armholes and necklines).
- **Bind off** — bind off the whole row (terminates a section).

You add, reorder, and edit sections until the section stack matches the silhouette you have in mind. The schematic renders the stack as stacked trapezoids. The instruction generator threads the rows together and produces a section-by-section pattern you can knit.

There is also a **hand vs. machine** toggle for the Custom Draft. It changes only the *vocabulary* of the generated instructions — "K2tog" vs. "transfer one stitch" — not the math.

---

## Stitch chart overlay

Below the gauge inputs there's a **Chart** panel. It's an empty grid until you open it; once opened, you have a stitch palette (knit / purl / yo / k2tog / ssk / cable / colorwork blocks) and a color palette. You paint the chart cell by cell.

The chart then renders **on top of the schematic silhouette**, clipped to the actual shape of the garment. So if you've drawn a 24-stitch cable cartouche, you can see exactly where it lands on the sweater front, the sleeve, the hat — wherever the shape allows it. This works for Body, Sleeve, Hat, Mitten, Sock, Shawl, and Rectangle. For Custom Draft, the overlay clips to the stacked-trapezoid silhouette.

The chart is also exported into the print view and into the saved pattern.

---

## Templates: 27 starting points

Above the form there's a **Templates** picker. It contains 27 preloaded garment recipes — common silhouettes like "Worsted-weight raglan pullover," "Toddler beanie," "Tube sock," "Garter shawl," etc. Picking one fills every form field with that template's numbers. You then change anything you want.

The templates are stored in inches and auto-convert to centimeters when applied if your unit is set to cm.

---

## Units (in / cm)

The Designer reads your **Profile → Units** preference (Profile page, "Units" tab) to decide whether to show every measurement in inches or centimeters. There is no in-page toggle; the unit shown is the unit your account is set to. A small line above the Gauge inputs reminds you which unit is active and links to the profile setting.

If you change your profile preference while the Designer is open, the form re-converts in place — 44 in becomes ~112 cm, etc. The same conversion runs when you reopen the Designer if your saved draft is in a unit different from your current preference.

mm is a valid profile preference for needle/cable sizing, but the Designer treats it as cm because body measurements in mm aren't useful.

---

## What you get out

When you fill enough fields for the math to be valid, three things become available:

1. **Live schematic** — updates with every keystroke. Includes measurements, stitch counts at seams, and (if you've drawn one) the chart overlay clipped to the silhouette.
2. **Per-section instructions** — readable plain-English vocabulary. Body example: "CO 88 sts. Work 8 rows in k1p1 rib. Continue in stockinette for 32 rows. Beg armhole shaping: BO 5 sts each side over 4 rows…"
3. **Print view** — a separate `/designer/print` route formatted for paper or PDF. Includes the schematic, the chart, all instructions, and gauge.

There are two save buttons in the header:
- **Save as Pattern** — writes the current draft into your pattern library as a real Rowly pattern. You can then start a project from it and track row progress just like an imported pattern.
- **Save to Project** — same, but immediately starts a new project from it.

Drafts are also auto-saved to your browser's local storage between sessions — you don't have to "save" to keep working on a draft.

---

## What it's not (yet)

Things to flag explicitly when getting feedback, since knitters might expect them:

- **No chart-symbol library beyond the built-in palette.** You can't import a Stitchmastery chart or paste in someone else's cable.
- **No yarn requirements estimate.** It tells you stitch counts, not "you'll need 1,200 yards of fingering."
- **No rendering of texture stitches in the schematic** — the schematic shows shape and chart cells, not garter ridges or bobble bumps.
- **No "share a draft" link.** Save it as a pattern first, then share via the pattern's normal share controls.
- **No multi-size grading.** One set of measurements per draft. To grade, duplicate the pattern and edit.
- **No top-down / bottom-up direction toggle.** The construction order is implied by the garment shape (sweater body is bottom-up, hat is bottom-up to crown, sock is top-down, shawl is top-down).
- **Hand vs. machine toggle is Custom Draft only.** It doesn't yet rewrite the preset shapes' instructions.

---

## Questions worth asking knitters

If you're showing this to working knitters or comparing it to KnitMachine Pro, these are the places where the design choices most need outside validation:

1. Does the **section-stack vocabulary** for Custom Draft (straight / ribbing / inc / dec / cast-off-each-side / bind-off) cover what you'd want to draft, or do you reach for something it doesn't have?
2. Do the **eight preset shapes** cover the garments you'd actually start in a tool like this, or are key silhouettes (cardigan? top-down yoke? gloves? pullover with a yoke chart?) missing?
3. Are the **default measurements** (chest 36 in, ease 4 in, etc.) close to your "first draft" instincts, or wildly off?
4. Is the **chart-on-schematic overlay** something you'd actually use to plan colorwork placement, or is it visual noise?
5. Do the **generated instructions** read like a pattern you could knit from cold, or do they feel machine-translated?
6. Is the **27-template starter library** the right size, the wrong shape, or pointed at the wrong garments?

Those six are the load-bearing design choices. Everything else is polish.
