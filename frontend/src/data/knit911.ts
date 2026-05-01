/**
 * Knit911 — CYC's beginner-panic help index.
 *
 * CYC publishes a "Knit911" page (knit911-home.html) with the
 * everyday troubleshooting topics knitters search for in real
 * language: "where did this extra stitch come from?", "I dropped a
 * stitch", "my edges curl", etc. The exact phrasing is the value —
 * if a beginner can find their own panic in our help index, they
 * trust us with their first project.
 *
 * This module ships the 18-topic seed catalog. The public
 * `/help/knit911` page lists them; the per-topic pages live at
 * `/help/knit911/:slug`. Future Make-mode + project views will
 * deep-link in via `topicForSituation()`.
 *
 * Source: Craft Yarn Council of America's www.YarnStandards.com
 * Knit911 home page (free-use license; credit required).
 */

export interface Knit911Topic {
  /** URL slug — kebab-case, used at /help/knit911/:slug. */
  slug: string;
  /** The user-facing question, in their own panic-language. */
  title: string;
  /** One-sentence summary for list views. */
  summary: string;
  /** Longer body. Markdown-style line breaks; renderer is plain text
   *  with paragraph splitting. */
  body: string;
  /** Loose category for the topic, drives the filter chip row. */
  category: 'stitches' | 'edges' | 'shaping' | 'finishing' | 'fixing';
}

export const KNIT911_TOPICS: Knit911Topic[] = [
  {
    slug: 'extra-stitches',
    title: 'Where did this extra stitch come from?',
    summary: 'Yarn-overs that looked like the working yarn, or a stitch worked twice into the same loop.',
    body: 'Extra stitches almost always come from one of two sources. Either you picked up the working yarn AND the strand behind it as if they were one loop (creating a yarn-over), or you knit into the same loop twice without pulling it off. Tink (knit backwards) one row at a time until the count matches your pattern. The mistake is usually within the last 2–3 rows, not earlier.',
    category: 'stitches',
  },
  {
    slug: 'missing-stitches',
    title: 'I have fewer stitches than I should',
    summary: 'A stitch dropped off the needle, or two were knit together by accident.',
    body: 'Look at the row below your needles. A dropped stitch shows as a long vertical ladder. If you see one, use a crochet hook to chain the loop back up through every horizontal bar. If there is no ladder, you likely knit two together by mistake — go back and re-knit those rows.',
    category: 'stitches',
  },
  {
    slug: 'dropped-stitch',
    title: 'I dropped a stitch',
    summary: 'Slip a crochet hook through the live loop and ladder it back up to the needle.',
    body: 'Don\'t panic — dropped stitches are easy to fix as long as the live loop is still intact. Insert a small crochet hook (one size smaller than your needle) into the loop. For each horizontal bar above, hook it through the loop and pull, working upward like a chain. When you reach the working row, slip the loop back onto the left needle in the right orientation.',
    category: 'fixing',
  },
  {
    slug: 'twisted-stitch',
    title: 'A stitch on my needle looks twisted',
    summary: 'The leading leg of the loop is at the back instead of the front — slip and rotate.',
    body: 'A twisted stitch sits with its right leg behind the needle instead of in front. Slip it off knitwise, rotate it 180°, and slide it back. Twisted stitches happen when a stitch was slipped to the right needle the wrong way, or when a dropped stitch was picked up backwards.',
    category: 'fixing',
  },
  {
    slug: 'curled-edges',
    title: 'My edges curl up — how do I stop them?',
    summary: 'Stockinette curls by nature; add a border in garter, ribbing, or seed stitch.',
    body: 'Stockinette stitch curls because the V-shaped knit columns pull tighter than the bumpy purl rows behind them. The fabric is doing what stockinette always does. To stop the curl, add a non-curling border: 4–6 stitches of garter, 1×1 or 2×2 ribbing, or seed stitch on each side, plus the same depth at top and bottom. Blocking helps somewhat but won\'t fully overcome the structural tendency.',
    category: 'edges',
  },
  {
    slug: 'gauge-off',
    title: 'My swatch gauge doesn\'t match the pattern',
    summary: 'Re-swatch with a different needle size — bigger needles for fewer stitches per inch.',
    body: 'If you have MORE stitches per 4 in than the pattern, your gauge is too tight — go up a needle size. FEWER stitches per 4 in means you\'re too loose — go down. Adjust by half-sizes if you can. Always measure after washing and blocking the swatch (most yarns relax). Don\'t cheat by knitting "looser on purpose"; the discipline only lasts a few rows.',
    category: 'shaping',
  },
  {
    slug: 'cast-on-too-tight',
    title: 'My cast-on edge is way tighter than the rest',
    summary: 'Cast on with a needle one or two sizes larger, then switch to the working size for row 1.',
    body: 'A tight cast-on yanks the bottom of the work in. Cast on using a needle 1–2 sizes larger than your working needle, then switch to the smaller size for row 1. Long-tail and cable cast-ons are particularly prone to tightening. If you notice late, you can sometimes loosen the bottom edge by pulling each cast-on stitch with a tapestry needle, but starting over is usually faster.',
    category: 'edges',
  },
  {
    slug: 'bind-off-too-tight',
    title: 'My bind-off won\'t stretch',
    summary: 'Bind off with a needle one or two sizes larger, or use Jeny\'s Surprisingly Stretchy bind-off.',
    body: 'A standard bind-off has almost no stretch — when applied to a sock cuff or sweater neckline it can be impossible to get on. Switch to a larger needle for the bind-off row, or use a stretchy method: Jeny\'s Surprisingly Stretchy Bind-off (yarn-over before each k or p, then pass the yo + previous st over) gives the most stretch.',
    category: 'edges',
  },
  {
    slug: 'k2tog-vs-ssk',
    title: 'When do I use k2tog vs ssk?',
    summary: 'k2tog leans right, ssk leans left — pair them on opposite seams for symmetric shaping.',
    body: 'k2tog (knit two together) puts the second stitch on top of the first; the visible decrease leans to the RIGHT. ssk (slip slip knit) reverses the orientation and leans LEFT. For a symmetric V-neck or raglan seam: k2tog AT the right edge of a decrease line and ssk just AFTER the left edge. The opposite ordering looks unbalanced.',
    category: 'shaping',
  },
  {
    slug: 'yarn-over-disappeared',
    title: 'My yarn-over vanished on the next row',
    summary: 'You worked it together with the next stitch instead of as its own loop.',
    body: 'A yo creates a new stitch on the right needle that you must work as its own stitch on the next row. If you can\'t see it on the next row, you probably knit it together with the adjacent stitch. Tink back to the row before the yo, re-do it carefully (yarn from front to back over the right needle), and on the next row work each loop separately.',
    category: 'stitches',
  },
  {
    slug: 'weaving-in-ends',
    title: 'How do I weave in ends so they don\'t pop out?',
    summary: 'Duplicate-stitch along a row of stockinette for several inches, change direction, then trim.',
    body: 'Thread the tail through a tapestry needle. Working on the wrong side, follow the path of an existing row of stitches for at least 2 in. Reverse direction and follow another row for another 1–2 in. The change in direction locks the tail. Trim flush, then stretch the fabric — if the cut end retracts under a stitch, you\'re done.',
    category: 'finishing',
  },
  {
    slug: 'blocking-knits',
    title: 'How do I block my knitting?',
    summary: 'Wet- or steam-block; pin to size, let dry, the fibers relax into shape.',
    body: 'Wet block: soak the piece in cool water with wool wash for 15 min, gently squeeze (don\'t wring), roll in a towel to remove excess water, then pin to your target dimensions on a blocking board. Let dry fully. Steam block: pin first, then hover a steam iron 1 in above (don\'t touch). Lace blocks aggressively — pin out every point. Wool blocks well; cotton and acrylic don\'t reshape much.',
    category: 'finishing',
  },
  {
    slug: 'mattress-stitch',
    title: 'How do I seam two pieces invisibly?',
    summary: 'Mattress stitch picks up the bar between the first two stitches on each side.',
    body: 'Lay both pieces side by side, RS up. With a long tail in a tapestry needle, alternate sides: pick up the horizontal bar between the first and second stitches of one side, then the same bar on the other. Pull snug every few stitches. The seam tucks behind the edge stitches and disappears — only the row count matters, and rows must match between pieces.',
    category: 'finishing',
  },
  {
    slug: 'reading-charts',
    title: 'How do I read a knitting chart?',
    summary: 'Right side rows: read right-to-left. Wrong side: read left-to-right.',
    body: 'Charts are read from BOTTOM to TOP, mirroring how knitted fabric grows. Right-side rows (odd-numbered, usually) read right-to-left because that\'s how stitches come off your right needle. Wrong-side rows reverse direction and any stitch symbol "purl on RS" becomes "knit on WS". Charts worked in the round read right-to-left on every round.',
    category: 'stitches',
  },
  {
    slug: 'magic-loop',
    title: 'How do I knit small circumferences without DPNs?',
    summary: 'Magic loop: use a 32"+ circular and pull the cable out at the halfway point.',
    body: 'Cast on as you would for a regular project on a 32 in or longer circular. Slide all stitches to the cable, then pull the cable out as a loop at the halfway point. You now have stitches on both needle tips with a loop of cable between them. Knit across the front needle, pull the cable through, rotate, knit across what is now the front. The two-needle setup works for any circumference smaller than the needle length.',
    category: 'stitches',
  },
  {
    slug: 'jogless-stripes',
    title: 'How do I avoid the "jog" between stripes when knitting in the round?',
    summary: 'Slip the first stitch of the second-color round, then carry on as normal.',
    body: 'When knitting in the round, the start of each round actually spirals up — so a color change shows as a stairstep "jog". To minimize the jog: at the start of the second round of a new color, slip the first stitch (instead of knitting it). The slipped stitch pulls the previous-round color up and fakes a smooth join. Works for clean 2+ row stripes; not for single-row stripes.',
    category: 'finishing',
  },
  {
    slug: 'short-rows',
    title: 'What are short rows for?',
    summary: 'Adding rows in part of the work — sock heels, sweater shoulders, bust darts.',
    body: 'Short rows turn the work before reaching the end of the row, leaving stitches unworked. They add fabric height in one section without adding rows everywhere. Common uses: sock heel turns, dropped-shoulder shaping, contoured shawls, and bust shaping in fitted garments. Wrap-and-turn (W&T), German short rows, and Japanese short rows are the three main techniques — German short rows are the easiest for beginners.',
    category: 'shaping',
  },
  {
    slug: 'tinking-vs-frogging',
    title: 'Tinking vs frogging — when to do which?',
    summary: 'Tink (knit backwards) for 1–2 rows. Frog (rip out) when more than ~3 rows back.',
    body: '"Tink" = "knit" backwards: undo one stitch at a time, slipping the live loop back onto the left needle. Slow but precise. "Frog" = pull the work off the needle and rip back several rows or more. Faster but you have to pick the live stitches back up. Rule of thumb: tink within 2 rows, frog beyond. For lace or cabled work, frog with a lifeline (a smooth waste-yarn thread run through a row you trust).',
    category: 'fixing',
  },
];

export const KNIT911_CATEGORIES: Array<{ id: Knit911Topic['category']; label: string }> = [
  { id: 'stitches', label: 'Stitches & charts' },
  { id: 'edges', label: 'Edges & cast-ons' },
  { id: 'shaping', label: 'Gauge & shaping' },
  { id: 'finishing', label: 'Finishing' },
  { id: 'fixing', label: 'Fixing mistakes' },
];

/** Look up a topic by slug. Returns NULL when not found. */
export function getKnit911Topic(slug: string): Knit911Topic | null {
  return KNIT911_TOPICS.find((t) => t.slug === slug) ?? null;
}

/**
 * Suggest a Knit911 topic given a knitting "situation" — used by
 * future Make-mode + project-detail surfaces to surface contextual
 * help. Today this is a simple keyword match; later it can graduate
 * to an LLM call or a richer rule set.
 *
 * @example topicForSituation('extra stitch') → 'extra-stitches'
 */
export function topicForSituation(situation: string): Knit911Topic | null {
  if (typeof situation !== 'string') return null;
  const haystack = situation.toLowerCase();

  const rules: Array<{ slug: string; needles: string[] }> = [
    { slug: 'extra-stitches', needles: ['extra stitch', 'too many st'] },
    { slug: 'missing-stitches', needles: ['missing stitch', 'fewer st', 'lost a st'] },
    { slug: 'dropped-stitch', needles: ['dropped', 'fell off'] },
    { slug: 'twisted-stitch', needles: ['twisted'] },
    { slug: 'curled-edges', needles: ['curl', 'edge'] },
    { slug: 'gauge-off', needles: ['gauge', 'tension', 'too small', 'too big'] },
    { slug: 'cast-on-too-tight', needles: ['cast on too tight', 'cast-on tight'] },
    { slug: 'bind-off-too-tight', needles: ['bind off', 'bind-off', 'cast off'] },
    { slug: 'k2tog-vs-ssk', needles: ['ssk', 'k2tog', 'lean'] },
    { slug: 'yarn-over-disappeared', needles: ['yarn over', 'yo gone', 'yo disappear'] },
    { slug: 'weaving-in-ends', needles: ['weave', 'tail', 'ends'] },
    { slug: 'blocking-knits', needles: ['block'] },
    { slug: 'mattress-stitch', needles: ['seam', 'mattress'] },
    { slug: 'reading-charts', needles: ['chart', 'symbol'] },
    { slug: 'magic-loop', needles: ['magic loop', 'small circ', 'dpn'] },
    { slug: 'jogless-stripes', needles: ['jog', 'stripe'] },
    { slug: 'short-rows', needles: ['short row', 'heel'] },
    { slug: 'tinking-vs-frogging', needles: ['tink', 'frog', 'rip out'] },
  ];

  for (const r of rules) {
    if (r.needles.some((n) => haystack.includes(n))) {
      return getKnit911Topic(r.slug);
    }
  }
  return null;
}
