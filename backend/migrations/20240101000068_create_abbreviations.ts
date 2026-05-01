import { Knex } from 'knex';

/**
 * Migration 068: canonical CYC abbreviation glossary.
 *
 * The `chart_symbol_templates` table only fits abbreviations that have a
 * visual chart glyph (k, p, k2tog, c4f...). Everything else CYC publishes
 * — `alt`, `beg`, `cont`, `MC`, `RS`, `tog`, the `*` / `[ ]` / `( )`
 * pattern-notation primitives, and most of the loom-knitting list — has
 * no glyph and shouldn't pollute the chart palette. So we keep this as a
 * separate, broader glossary surface.
 *
 * Schema notes:
 *   - `abbreviation` is case-sensitive on purpose. `BO` (knit bind off)
 *     and `bo` (crochet bobble) coexist in CYC and must coexist here.
 *   - `craft` enumerates the four CYC abbreviation lists. Some terms
 *     (yo, ch, MC, CC, RS, WS) appear in multiple lists with the same
 *     expansion — we store one row per (abbreviation, craft) pair so the
 *     glossary can be filtered cleanly by craft without ambiguity.
 *   - `category` groups entries for the glossary UI (stitch, increase,
 *     decrease, instruction, color, materials, notation, post, special).
 *   - `is_system` + nullable `user_id` mirrors `chart_symbol_templates`
 *     so users can later author custom abbreviations.
 *
 * Source: Craft Yarn Council of America's www.YarnStandards.com.
 * Loom-knit `UK` = u-wrap knit (NOT United Kingdom); seeded as such.
 */

interface AbbrSeed {
  abbreviation: string;
  expansion: string;
  description?: string | null;
  craft: 'knit' | 'crochet' | 'tunisian' | 'loom-knit';
  category: string;
}

// Knit list — CYC canonical, ~80 entries.
const KNIT: AbbrSeed[] = [
  { abbreviation: 'alt', expansion: 'alternate', craft: 'knit', category: 'instruction' },
  { abbreviation: 'approx', expansion: 'approximately', craft: 'knit', category: 'instruction' },
  { abbreviation: 'beg', expansion: 'begin / beginning', craft: 'knit', category: 'instruction' },
  { abbreviation: 'bet', expansion: 'between', craft: 'knit', category: 'instruction' },
  { abbreviation: 'BO', expansion: 'bind off', description: 'Also "cast off" in UK and Canadian patterns. Case-sensitive: lowercase "bo" is a crochet bobble.', craft: 'knit', category: 'instruction' },
  { abbreviation: 'CC', expansion: 'contrasting color', craft: 'knit', category: 'color' },
  { abbreviation: 'ch', expansion: 'chain', craft: 'knit', category: 'stitch' },
  { abbreviation: 'cm', expansion: 'centimeter(s)', craft: 'knit', category: 'materials' },
  { abbreviation: 'cn', expansion: 'cable needle', craft: 'knit', category: 'materials' },
  { abbreviation: 'CO', expansion: 'cast on', craft: 'knit', category: 'instruction' },
  { abbreviation: 'cont', expansion: 'continue / continuing', craft: 'knit', category: 'instruction' },
  { abbreviation: 'dec', expansion: 'decrease / decreases / decreasing', craft: 'knit', category: 'decrease' },
  { abbreviation: "dec'd", expansion: 'decreased', craft: 'knit', category: 'decrease' },
  { abbreviation: 'dpn', expansion: 'double-pointed needle(s)', craft: 'knit', category: 'materials' },
  { abbreviation: 'fl', expansion: 'front loop(s)', craft: 'knit', category: 'instruction' },
  { abbreviation: 'foll', expansion: 'follow / follows / following', craft: 'knit', category: 'instruction' },
  { abbreviation: 'g', expansion: 'gram(s)', craft: 'knit', category: 'materials' },
  { abbreviation: 'inc', expansion: 'increase / increases / increasing', craft: 'knit', category: 'increase' },
  { abbreviation: "inc'd", expansion: 'increased', craft: 'knit', category: 'increase' },
  { abbreviation: 'k', expansion: 'knit', craft: 'knit', category: 'stitch' },
  { abbreviation: 'k1tbl', expansion: 'knit 1 stitch through back loop', craft: 'knit', category: 'stitch' },
  { abbreviation: 'k2tog', expansion: 'knit 2 stitches together', description: 'Right-leaning decrease — 1 stitch decreased.', craft: 'knit', category: 'decrease' },
  { abbreviation: 'k3tog', expansion: 'knit 3 stitches together', description: '2 stitches decreased.', craft: 'knit', category: 'decrease' },
  { abbreviation: 'kfb', expansion: 'knit into front and back of stitch', description: '1 stitch increased — bar increase.', craft: 'knit', category: 'increase' },
  { abbreviation: 'kwise', expansion: 'knitwise', description: 'Insert needle as if to knit.', craft: 'knit', category: 'instruction' },
  { abbreviation: 'LH', expansion: 'left hand', craft: 'knit', category: 'instruction' },
  { abbreviation: 'lp(s)', expansion: 'loop(s)', craft: 'knit', category: 'stitch' },
  { abbreviation: 'm', expansion: 'meter(s) — or marker, in stitch context', description: 'Overloaded: in materials sections this is meters. Inside row instructions ("sl m", "pm") it is a marker.', craft: 'knit', category: 'materials' },
  { abbreviation: 'M1', expansion: 'make 1 stitch', description: '1 stitch increased — picks up the bar between stitches and knits it.', craft: 'knit', category: 'increase' },
  { abbreviation: 'M1L', expansion: 'make 1 left', description: 'Left-leaning lifted increase.', craft: 'knit', category: 'increase' },
  { abbreviation: 'M1R', expansion: 'make 1 right', description: 'Right-leaning lifted increase.', craft: 'knit', category: 'increase' },
  { abbreviation: 'MC', expansion: 'main color', craft: 'knit', category: 'color' },
  { abbreviation: 'mm', expansion: 'millimeter(s)', craft: 'knit', category: 'materials' },
  { abbreviation: 'oz', expansion: 'ounce(s)', craft: 'knit', category: 'materials' },
  { abbreviation: 'p', expansion: 'purl', craft: 'knit', category: 'stitch' },
  { abbreviation: 'p2tog', expansion: 'purl 2 stitches together', description: '1 stitch decreased.', craft: 'knit', category: 'decrease' },
  { abbreviation: 'p3tog', expansion: 'purl 3 stitches together', craft: 'knit', category: 'decrease' },
  { abbreviation: 'pat(s)', expansion: 'pattern(s)', craft: 'knit', category: 'instruction' },
  { abbreviation: 'patt(s)', expansion: 'pattern(s)', craft: 'knit', category: 'instruction' },
  { abbreviation: 'pfb', expansion: 'purl into front and back of stitch', description: '1 stitch increased.', craft: 'knit', category: 'increase' },
  { abbreviation: 'pm', expansion: 'place marker', craft: 'knit', category: 'instruction' },
  { abbreviation: 'prev', expansion: 'previous', craft: 'knit', category: 'instruction' },
  { abbreviation: 'psso', expansion: 'pass slipped stitch over', craft: 'knit', category: 'decrease' },
  { abbreviation: 'p2sso', expansion: 'pass 2 slipped stitches over', craft: 'knit', category: 'decrease' },
  { abbreviation: 'pwise', expansion: 'purlwise', description: 'Insert needle as if to purl.', craft: 'knit', category: 'instruction' },
  { abbreviation: 'rem', expansion: 'remain / remaining', craft: 'knit', category: 'instruction' },
  { abbreviation: 'rep', expansion: 'repeat(s)', craft: 'knit', category: 'instruction' },
  { abbreviation: 'rev St st', expansion: 'reverse stockinette stitch', description: 'Purl side facing front.', craft: 'knit', category: 'stitch' },
  { abbreviation: 'RH', expansion: 'right hand', craft: 'knit', category: 'instruction' },
  { abbreviation: 'rnd(s)', expansion: 'round(s)', craft: 'knit', category: 'instruction' },
  { abbreviation: 'RS', expansion: 'right side', craft: 'knit', category: 'instruction' },
  { abbreviation: 'sk', expansion: 'skip', craft: 'knit', category: 'instruction' },
  { abbreviation: 'skp', expansion: 'slip, knit, pass slipped stitch over', description: '1 stitch decreased.', craft: 'knit', category: 'decrease' },
  { abbreviation: 'sk2p', expansion: 'slip 1, knit 2 together, pass slipped stitch over', description: '2 stitches decreased.', craft: 'knit', category: 'decrease' },
  { abbreviation: 'sl', expansion: 'slip', craft: 'knit', category: 'stitch' },
  { abbreviation: 'sl1k', expansion: 'slip 1 knitwise', craft: 'knit', category: 'stitch' },
  { abbreviation: 'sl1p', expansion: 'slip 1 purlwise', craft: 'knit', category: 'stitch' },
  { abbreviation: 'sl st', expansion: 'slip stitch', craft: 'knit', category: 'stitch' },
  { abbreviation: 'ss', expansion: 'slip stitch (UK)', description: 'UK / Canadian abbreviation for slip stitch in knitting.', craft: 'knit', category: 'stitch' },
  { abbreviation: 'ssk', expansion: 'slip, slip, knit these 2 stitches together', description: 'Left-leaning decrease — 1 stitch decreased. Mirror of k2tog.', craft: 'knit', category: 'decrease' },
  { abbreviation: 'sssk', expansion: 'slip, slip, slip, knit 3 together', description: '2 stitches decreased.', craft: 'knit', category: 'decrease' },
  { abbreviation: 'ssp', expansion: 'slip, slip, purl 2 together through back loop', description: '1 stitch decreased — purled equivalent of ssk.', craft: 'knit', category: 'decrease' },
  { abbreviation: 'st(s)', expansion: 'stitch(es)', craft: 'knit', category: 'stitch' },
  { abbreviation: 'St st', expansion: 'stockinette stitch', description: 'Knit on RS, purl on WS.', craft: 'knit', category: 'stitch' },
  { abbreviation: 'tbl', expansion: 'through back loop', craft: 'knit', category: 'instruction' },
  { abbreviation: 'tog', expansion: 'together', craft: 'knit', category: 'instruction' },
  { abbreviation: 'WS', expansion: 'wrong side', craft: 'knit', category: 'instruction' },
  { abbreviation: 'wyib', expansion: 'with yarn in back', craft: 'knit', category: 'instruction' },
  { abbreviation: 'wyif', expansion: 'with yarn in front', craft: 'knit', category: 'instruction' },
  { abbreviation: 'yd(s)', expansion: 'yard(s)', craft: 'knit', category: 'materials' },
  { abbreviation: 'yfwd', expansion: 'yarn forward', description: 'UK term — equivalent to "yo" in US patterns.', craft: 'knit', category: 'stitch' },
  { abbreviation: 'yo', expansion: 'yarn over', description: 'Adds 1 stitch and creates an eyelet.', craft: 'knit', category: 'increase' },
  { abbreviation: 'yo2', expansion: 'yarn over twice', description: 'Double yarn over — adds 2 stitches.', craft: 'knit', category: 'increase' },
  { abbreviation: 'yon', expansion: 'yarn over needle', description: 'UK variant — equivalent to "yo".', craft: 'knit', category: 'increase' },
  { abbreviation: 'yrn', expansion: 'yarn round needle', description: 'UK variant — equivalent to "yo".', craft: 'knit', category: 'increase' },
  { abbreviation: 'C2B', expansion: 'cable 2 back', craft: 'knit', category: 'stitch' },
  { abbreviation: 'C2F', expansion: 'cable 2 front', craft: 'knit', category: 'stitch' },
  { abbreviation: 'C4B', expansion: 'cable 4 back', description: 'sl 2 to cn, hold back, k2, k2 from cn.', craft: 'knit', category: 'stitch' },
  { abbreviation: 'C4F', expansion: 'cable 4 front', description: 'sl 2 to cn, hold front, k2, k2 from cn.', craft: 'knit', category: 'stitch' },
  { abbreviation: 'C6B', expansion: 'cable 6 back', craft: 'knit', category: 'stitch' },
  { abbreviation: 'C6F', expansion: 'cable 6 front', craft: 'knit', category: 'stitch' },
  { abbreviation: 'T2B', expansion: 'twist 2 back', craft: 'knit', category: 'stitch' },
  { abbreviation: 'T2F', expansion: 'twist 2 front', craft: 'knit', category: 'stitch' },
  { abbreviation: 'T3B', expansion: 'twist 3 back', craft: 'knit', category: 'stitch' },
  { abbreviation: 'T3F', expansion: 'twist 3 front', craft: 'knit', category: 'stitch' },
  { abbreviation: '*', expansion: 'repeat instructions following the asterisk as directed', craft: 'knit', category: 'notation' },
  { abbreviation: '[ ]', expansion: 'work instructions within brackets as directed', craft: 'knit', category: 'notation' },
  { abbreviation: '( )', expansion: 'work instructions within parentheses as directed', craft: 'knit', category: 'notation' },
  { abbreviation: '"', expansion: 'inch(es)', craft: 'knit', category: 'materials' },
];

// Crochet list — CYC canonical (US dialect), ~60 entries.
const CROCHET: AbbrSeed[] = [
  { abbreviation: 'alt', expansion: 'alternate', craft: 'crochet', category: 'instruction' },
  { abbreviation: 'approx', expansion: 'approximately', craft: 'crochet', category: 'instruction' },
  { abbreviation: 'beg', expansion: 'begin / beginning', craft: 'crochet', category: 'instruction' },
  { abbreviation: 'bet', expansion: 'between', craft: 'crochet', category: 'instruction' },
  { abbreviation: 'BL', expansion: 'back loop(s) only', description: 'Work the stitch into the back loop only — leaves the front loop free for texture.', craft: 'crochet', category: 'instruction' },
  { abbreviation: 'BLO', expansion: 'back loop only', craft: 'crochet', category: 'instruction' },
  { abbreviation: 'bo', expansion: 'bobble', description: 'Case-sensitive: lowercase. Uppercase "BO" is the knitting bind-off.', craft: 'crochet', category: 'special' },
  { abbreviation: 'BP', expansion: 'back post', craft: 'crochet', category: 'post' },
  { abbreviation: 'BPdc', expansion: 'back post double crochet', craft: 'crochet', category: 'post' },
  { abbreviation: 'BPsc', expansion: 'back post single crochet', craft: 'crochet', category: 'post' },
  { abbreviation: 'BPtr', expansion: 'back post treble crochet', craft: 'crochet', category: 'post' },
  { abbreviation: 'CC', expansion: 'contrasting color', craft: 'crochet', category: 'color' },
  { abbreviation: 'ch', expansion: 'chain stitch', craft: 'crochet', category: 'stitch' },
  { abbreviation: 'ch-', expansion: 'refers to chain or space previously made', description: 'e.g. "ch-1 space" — work into the chain made on the previous row.', craft: 'crochet', category: 'notation' },
  { abbreviation: 'ch-sp', expansion: 'chain space', craft: 'crochet', category: 'notation' },
  { abbreviation: 'CL', expansion: 'cluster', description: 'Multiple partial stitches joined at top.', craft: 'crochet', category: 'special' },
  { abbreviation: 'cm', expansion: 'centimeter(s)', craft: 'crochet', category: 'materials' },
  { abbreviation: 'cont', expansion: 'continue', craft: 'crochet', category: 'instruction' },
  { abbreviation: 'dc', expansion: 'double crochet', description: 'US dialect. UK "double crochet" is the US "single crochet" — entire crochet stitch stack is offset by one between US and UK.', craft: 'crochet', category: 'stitch' },
  { abbreviation: 'dc2tog', expansion: 'double crochet 2 stitches together', description: '1 stitch decreased.', craft: 'crochet', category: 'decrease' },
  { abbreviation: 'dec', expansion: 'decrease', craft: 'crochet', category: 'decrease' },
  { abbreviation: 'dtr', expansion: 'double treble (US) / triple treble (UK)', craft: 'crochet', category: 'stitch' },
  { abbreviation: 'ea', expansion: 'each', craft: 'crochet', category: 'instruction' },
  { abbreviation: 'FL', expansion: 'front loop(s) only', craft: 'crochet', category: 'instruction' },
  { abbreviation: 'FLO', expansion: 'front loop only', craft: 'crochet', category: 'instruction' },
  { abbreviation: 'foll', expansion: 'follow / following', craft: 'crochet', category: 'instruction' },
  { abbreviation: 'FP', expansion: 'front post', craft: 'crochet', category: 'post' },
  { abbreviation: 'FPdc', expansion: 'front post double crochet', craft: 'crochet', category: 'post' },
  { abbreviation: 'FPsc', expansion: 'front post single crochet', craft: 'crochet', category: 'post' },
  { abbreviation: 'FPtr', expansion: 'front post treble crochet', craft: 'crochet', category: 'post' },
  { abbreviation: 'g', expansion: 'gram(s)', craft: 'crochet', category: 'materials' },
  { abbreviation: 'hdc', expansion: 'half double crochet', description: 'US dialect. Stitch height between sc and dc.', craft: 'crochet', category: 'stitch' },
  { abbreviation: 'hdc2tog', expansion: 'half double crochet 2 stitches together', craft: 'crochet', category: 'decrease' },
  { abbreviation: 'inc', expansion: 'increase', craft: 'crochet', category: 'increase' },
  { abbreviation: 'lp(s)', expansion: 'loop(s)', craft: 'crochet', category: 'stitch' },
  { abbreviation: 'm', expansion: 'meter(s) — or marker in stitch context', craft: 'crochet', category: 'materials' },
  { abbreviation: 'MC', expansion: 'main color', craft: 'crochet', category: 'color' },
  { abbreviation: 'mm', expansion: 'millimeter(s)', craft: 'crochet', category: 'materials' },
  { abbreviation: 'oz', expansion: 'ounce(s)', craft: 'crochet', category: 'materials' },
  { abbreviation: 'p', expansion: 'picot', craft: 'crochet', category: 'special' },
  { abbreviation: 'pat', expansion: 'pattern', craft: 'crochet', category: 'instruction' },
  { abbreviation: 'patt', expansion: 'pattern', craft: 'crochet', category: 'instruction' },
  { abbreviation: 'pc', expansion: 'popcorn', description: '5 dc joined at top into a raised bobble.', craft: 'crochet', category: 'special' },
  { abbreviation: 'pm', expansion: 'place marker', craft: 'crochet', category: 'instruction' },
  { abbreviation: 'prev', expansion: 'previous', craft: 'crochet', category: 'instruction' },
  { abbreviation: 'rem', expansion: 'remain / remaining', craft: 'crochet', category: 'instruction' },
  { abbreviation: 'rep', expansion: 'repeat(s)', craft: 'crochet', category: 'instruction' },
  { abbreviation: 'rev sc', expansion: 'reverse single crochet', description: 'Crab stitch — worked left to right for a corded edge.', craft: 'crochet', category: 'special' },
  { abbreviation: 'rnd(s)', expansion: 'round(s)', craft: 'crochet', category: 'instruction' },
  { abbreviation: 'RS', expansion: 'right side', craft: 'crochet', category: 'instruction' },
  { abbreviation: 'sc', expansion: 'single crochet', description: 'US dialect. UK "single crochet" is a slip stitch — be sure of the dialect before working.', craft: 'crochet', category: 'stitch' },
  { abbreviation: 'sc2tog', expansion: 'single crochet 2 stitches together', description: 'Invisible decrease — 1 stitch decreased.', craft: 'crochet', category: 'decrease' },
  { abbreviation: 'sk', expansion: 'skip', craft: 'crochet', category: 'instruction' },
  { abbreviation: 'sl st', expansion: 'slip stitch', craft: 'crochet', category: 'stitch' },
  { abbreviation: 'sp(s)', expansion: 'space(s)', craft: 'crochet', category: 'notation' },
  { abbreviation: 'st(s)', expansion: 'stitch(es)', craft: 'crochet', category: 'stitch' },
  { abbreviation: 'tch', expansion: 'turning chain', description: 'Chain made at row start to bring height; whether it counts as a stitch depends on the parent stitch (sc tch usually does NOT count, dc tch does).', craft: 'crochet', category: 'notation' },
  { abbreviation: 'tog', expansion: 'together', craft: 'crochet', category: 'instruction' },
  { abbreviation: 'tr', expansion: 'treble crochet', description: 'US dialect — taller than dc. UK "tr" is the US "dc" (one stitch shorter).', craft: 'crochet', category: 'stitch' },
  { abbreviation: 'trtr', expansion: 'triple treble crochet', craft: 'crochet', category: 'stitch' },
  { abbreviation: 'WS', expansion: 'wrong side', craft: 'crochet', category: 'instruction' },
  { abbreviation: 'yd(s)', expansion: 'yard(s)', craft: 'crochet', category: 'materials' },
  { abbreviation: 'yo', expansion: 'yarn over', craft: 'crochet', category: 'stitch' },
  { abbreviation: 'yoh', expansion: 'yarn over hook', craft: 'crochet', category: 'stitch' },
  { abbreviation: '*', expansion: 'repeat instructions following the asterisk as directed', craft: 'crochet', category: 'notation' },
  { abbreviation: '[ ]', expansion: 'work instructions within brackets as directed', craft: 'crochet', category: 'notation' },
  { abbreviation: '( )', expansion: 'work instructions within parentheses as directed', craft: 'crochet', category: 'notation' },
];

// Tunisian list — CYC canonical, ~14 entries.
const TUNISIAN: AbbrSeed[] = [
  { abbreviation: 'tss', expansion: 'Tunisian simple stitch', description: 'The default Tunisian stitch — vertical bar pulled up.', craft: 'tunisian', category: 'stitch' },
  { abbreviation: 'tks', expansion: 'Tunisian knit stitch', description: 'Insert hook from front to back through vertical bar — produces a knit-look fabric.', craft: 'tunisian', category: 'stitch' },
  { abbreviation: 'tps', expansion: 'Tunisian purl stitch', description: 'Yarn forward, insert under vertical bar — produces a purled-look fabric.', craft: 'tunisian', category: 'stitch' },
  { abbreviation: 'trs', expansion: 'Tunisian reverse stitch', craft: 'tunisian', category: 'stitch' },
  { abbreviation: 'tfs', expansion: 'Tunisian full stitch', description: 'Worked into the space between vertical bars rather than the bar itself.', craft: 'tunisian', category: 'stitch' },
  { abbreviation: 'ths', expansion: 'Tunisian half stitch', craft: 'tunisian', category: 'stitch' },
  { abbreviation: 'tdc', expansion: 'Tunisian double crochet', craft: 'tunisian', category: 'stitch' },
  { abbreviation: 'fwd', expansion: 'forward pass', description: 'First half of every Tunisian row — pick up loops onto the hook.', craft: 'tunisian', category: 'instruction' },
  { abbreviation: 'ret', expansion: 'return pass', description: 'Second half of every Tunisian row — work loops off the hook.', craft: 'tunisian', category: 'instruction' },
  { abbreviation: 'ch', expansion: 'chain', craft: 'tunisian', category: 'stitch' },
  { abbreviation: 'sl st', expansion: 'slip stitch', craft: 'tunisian', category: 'stitch' },
  { abbreviation: 'yo', expansion: 'yarn over', craft: 'tunisian', category: 'stitch' },
  { abbreviation: 'st(s)', expansion: 'stitch(es)', craft: 'tunisian', category: 'stitch' },
  { abbreviation: 'lp(s)', expansion: 'loop(s)', craft: 'tunisian', category: 'stitch' },
];

// Loom-knit list — CYC canonical, ~25 entries.
//
// IMPORTANT: in loom knitting, "UK" abbreviates "u-wrap knit" (a stitch
// type), NOT United Kingdom. Easy to misread without context.
const LOOM_KNIT: AbbrSeed[] = [
  { abbreviation: 'CO', expansion: 'cast on', craft: 'loom-knit', category: 'instruction' },
  { abbreviation: 'BO', expansion: 'bind off', description: 'Also "cast off". Several loom bind-off methods exist (basic, gather, drawstring, crochet).', craft: 'loom-knit', category: 'instruction' },
  { abbreviation: 'EW', expansion: 'e-wrap', description: 'The basic loom stitch — wrap each peg in an "e" shape, then knit over. Produces a twisted-stitch fabric.', craft: 'loom-knit', category: 'stitch' },
  { abbreviation: 'UK', expansion: 'u-wrap knit', description: 'NOT United Kingdom. A stitch made by laying yarn across the front of the peg without wrapping, then lifting the bottom loop over.', craft: 'loom-knit', category: 'stitch' },
  { abbreviation: 'FK', expansion: 'flat knit', description: 'Also called "true knit". Yarn held in front, hook lifts existing loop over the new strand.', craft: 'loom-knit', category: 'stitch' },
  { abbreviation: 'PK', expansion: 'purl knit', description: 'Loom purl — yarn held below the peg, hook scoops down through the existing loop.', craft: 'loom-knit', category: 'stitch' },
  { abbreviation: 'K', expansion: 'knit (loom)', craft: 'loom-knit', category: 'stitch' },
  { abbreviation: 'P', expansion: 'purl (loom)', craft: 'loom-knit', category: 'stitch' },
  { abbreviation: 'KO', expansion: 'knit over', description: 'Lift the bottom loop on a peg over the top yarn and off the peg.', craft: 'loom-knit', category: 'instruction' },
  { abbreviation: 'WP', expansion: 'wrap peg', craft: 'loom-knit', category: 'instruction' },
  { abbreviation: 'SK', expansion: 'skip peg', craft: 'loom-knit', category: 'instruction' },
  { abbreviation: 'sl', expansion: 'slip', craft: 'loom-knit', category: 'stitch' },
  { abbreviation: 'dec', expansion: 'decrease', craft: 'loom-knit', category: 'decrease' },
  { abbreviation: 'inc', expansion: 'increase', craft: 'loom-knit', category: 'increase' },
  { abbreviation: 'tog', expansion: 'together', craft: 'loom-knit', category: 'instruction' },
  { abbreviation: 'CC', expansion: 'contrasting color', craft: 'loom-knit', category: 'color' },
  { abbreviation: 'MC', expansion: 'main color', craft: 'loom-knit', category: 'color' },
  { abbreviation: 'rnd(s)', expansion: 'round(s)', craft: 'loom-knit', category: 'instruction' },
  { abbreviation: 'row(s)', expansion: 'row(s)', craft: 'loom-knit', category: 'instruction' },
  { abbreviation: 'RS', expansion: 'right side', craft: 'loom-knit', category: 'instruction' },
  { abbreviation: 'WS', expansion: 'wrong side', craft: 'loom-knit', category: 'instruction' },
  { abbreviation: 'st(s)', expansion: 'stitch(es)', craft: 'loom-knit', category: 'stitch' },
  { abbreviation: 'lp(s)', expansion: 'loop(s)', craft: 'loom-knit', category: 'stitch' },
  { abbreviation: 'yd(s)', expansion: 'yard(s)', craft: 'loom-knit', category: 'materials' },
  { abbreviation: 'anchor peg', expansion: 'anchor peg', description: 'Peg used to hold the yarn tail at cast-on. Not part of the working row.', craft: 'loom-knit', category: 'materials' },
];

const ALL_SEEDS: AbbrSeed[] = [...KNIT, ...CROCHET, ...TUNISIAN, ...LOOM_KNIT];

const VALID_CRAFTS = ['knit', 'crochet', 'tunisian', 'loom-knit'];

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('abbreviations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('abbreviation', 32).notNullable();
    table.string('expansion', 200).notNullable();
    table.text('description').nullable();
    table.string('craft', 16).notNullable();
    table.string('category', 32).notNullable();
    table.boolean('is_system').notNullable().defaultTo(true);
    table.uuid('user_id').nullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['craft'], 'idx_abbreviations_craft');
    table.index(['category'], 'idx_abbreviations_category');
    table.index(['user_id'], 'idx_abbreviations_user_id');
  });

  // Case-sensitive uniqueness on (abbreviation, craft, user_id) so:
  //   - System rows (user_id NULL) are unique per (abbreviation, craft).
  //   - A user can author their own custom row that shadows a system one.
  //   - "BO" (knit) and "bo" (crochet) are distinct — case-sensitive.
  // Postgres NULL-distinct semantics make user_id NULL == NULL, so the
  // partial unique index handles the system-uniqueness case explicitly.
  await knex.raw(
    `CREATE UNIQUE INDEX abbreviations_unique_system
       ON abbreviations (abbreviation, craft)
       WHERE user_id IS NULL`
  );
  await knex.raw(
    `CREATE UNIQUE INDEX abbreviations_unique_user
       ON abbreviations (abbreviation, craft, user_id)
       WHERE user_id IS NOT NULL`
  );

  await knex.raw(
    `ALTER TABLE abbreviations
       ADD CONSTRAINT abbreviations_craft_check
       CHECK (craft IN ('${VALID_CRAFTS.join("', '")}'))`
  );

  // Bulk insert — each seed is a system row (is_system=true, user_id=NULL).
  // Knex insert with an array uses a single multi-row INSERT.
  await knex('abbreviations').insert(
    ALL_SEEDS.map((seed) => ({
      abbreviation: seed.abbreviation,
      expansion: seed.expansion,
      description: seed.description ?? null,
      craft: seed.craft,
      category: seed.category,
      is_system: true,
      user_id: null,
    }))
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('abbreviations');
}
