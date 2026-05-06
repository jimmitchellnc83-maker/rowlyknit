/**
 * JSON-LD structured-data payloads for the public calculator pages.
 *
 * The same payloads are emitted client-side by `useSeo` in:
 *   - frontend/src/pages/Calculators.tsx          (/calculators)
 *   - frontend/src/pages/GaugeCalculator.tsx      (/calculators/gauge)
 *   - frontend/src/pages/GiftSizeCalculator.tsx   (/calculators/size, alias /calculators/gift-size)
 *
 * Google's renderer executes the SPA's JS so it sees the client-injected
 * versions, but Bing, Pinterest, and Facebook's scraper read static HTML
 * and miss anything React adds after hydration. This module is the
 * server-side source for those crawlers.
 *
 * The payloads are intentionally duplicated rather than imported from the
 * frontend (no shared package layer between the two builds yet). Keep
 * this file in sync when calculator copy/FAQ changes; cover with a curl
 * smoke check (`grep -c application/ld+json`) per the PR test plan.
 */

const ORG_PUBLISHER = {
  '@type': 'Organization',
  name: 'Rowly',
  url: 'https://rowlyknit.com/',
};

const FREE_OFFER = {
  '@type': 'Offer',
  price: '0',
  priceCurrency: 'USD',
};

const BREADCRUMB_HOME = {
  '@type': 'ListItem',
  position: 1,
  name: 'Home',
  item: 'https://rowlyknit.com/',
};

const BREADCRUMB_CALCULATORS = {
  '@type': 'ListItem',
  position: 2,
  name: 'Calculators',
  item: 'https://rowlyknit.com/calculators',
};

interface Faq {
  q: string;
  a: string;
}

const GAUGE_FAQS: Faq[] = [
  {
    q: 'What is gauge in knitting?',
    a: "Gauge is how many stitches and rows fit in a fixed area — usually a 4 in (10 cm) square. It's set by your yarn, needles, and tension. Two knitters using the same pattern can produce wildly different sizes if their gauges don't match.",
  },
  {
    q: 'How do I measure gauge?',
    a: "Knit a swatch at least 6 in (15 cm) wide, in the same stitch pattern as the project. Block it the way you'll wash the finished piece. Lay it flat, then count stitches and rows across a 4 in section in the middle — avoid the edges, they distort.",
  },
  {
    q: "What if I'm off-gauge?",
    a: 'Too many stitches per inch = swatch is tight, go up a needle size. Too few = swatch is loose, go down. If only the row gauge is off, you can usually live with it for flat shapes (just track length by inches, not rows). For shaped pieces — sweater yokes, hat decreases — match both.',
  },
  {
    q: 'Should I block my swatch first?',
    a: "Yes. Most yarns relax or grow when wet, sometimes by 5–10%. Measuring an unblocked swatch gives you a number that won't match the finished garment. Wash and lay flat to dry exactly as you'll launder it.",
  },
];

const GIFT_SIZE_FAQS: Faq[] = [
  {
    q: "How do I size a sweater for someone I can't measure?",
    a: 'Estimate their chest measurement from a similar-sized garment in their closet (lay it flat, measure across the chest just below the armholes, then double). Pick a fit style that matches what they normally wear. The calculator handles the rest.',
  },
  {
    q: "What's the difference between fitted, classic, and oversized?",
    a: 'Fit style controls ease — how much bigger the finished garment is than the body. Close-fit is negative (stretches over the body), classic is +2 in, relaxed is +4 in, and oversized is +6 in or more. Pick the same style as a sweater they already wear and like.',
  },
  {
    q: 'Can I use this for hats, baby clothes, or other knitted gifts?',
    a: 'The calculator targets sweaters and pullovers (chest-based sizing). For hats, the right reference is head circumference, not chest — most pattern designers list it in the size chart. Baby sweaters use chest-based sizing too, and the baby scheme is included.',
  },
  {
    q: 'Why does the recommendation differ between schemes?',
    a: "Different sizing systems use different chest-range bands. A 38 in chest might be a Women's M but a Men's S — patterns published in different schemes are calibrated to different reference bodies. Pick the scheme your pattern uses.",
  },
];

const YARDAGE_FAQS: Faq[] = [
  {
    q: 'How do I estimate yarn yardage for a project?',
    a: 'The calculator multiplies a per-size yardage band for the garment type by your yarn-weight factor. The bands come from finished-garment averages, not pattern-specific math, so treat the result as a planning ceiling — buy a little extra if you tend to swatch a lot or knit loose.',
  },
  {
    q: 'How many skeins should I buy?',
    a: 'Round the recommended yards up by your skein length, then add one skein for safety. Dye lots can drift between batches, so finishing short on a single skein from a different lot can leave a visible color line.',
  },
  {
    q: 'Why do worsted and fingering yardage estimates differ so much?',
    a: 'Thinner yarns need more length to cover the same fabric area. A worsted-weight pullover might need ~1,200 yds; the same shape in fingering can need ~2,000 yds because the gauge is finer and the rows count up faster.',
  },
];

const ROW_REPEAT_FAQS: Faq[] = [
  {
    q: "What's a row repeat?",
    a: 'A repeat is a chunk of pattern that recurs vertically (in rows) or around (in rounds). Calculators like this one help you figure out how many full repeats fit between two markers — the start of a sleeve cap, a yoke decrease section, etc. — so you can place them evenly.',
  },
  {
    q: "What if my repeat doesn't divide evenly into the rows?",
    a: 'Either work the partial repeat as plain rows top or bottom of the section, or shift one full repeat across two sections to rebalance. The calculator shows the remainder so you can decide where to absorb it.',
  },
  {
    q: 'Does this work for in-the-round projects?',
    a: 'Yes — round counts work the same way as flat rows for repeat math. Use the round count between the two reference points (e.g. start of yoke to first decrease round) and the repeat-round count.',
  },
];

const SHAPING_FAQS: Faq[] = [
  {
    q: 'How do I space increases or decreases evenly along a piece?',
    a: 'Divide rows-available by the number of shaping rows you need. The calculator does this for you and produces an "every Nth row" plan — sometimes split into two cadences (e.g. "5× every 4th row, then 3× every 6th row") so the total still lands on the row count you have.',
  },
  {
    q: 'Why does the plan use two different cadences?',
    a: "When the start-to-end stitch difference doesn't divide cleanly into rows-available, a single 'every Nth row' would either run out before the end or land past the end. Splitting into two cadences keeps the spacing visually even while landing on exactly the right row.",
  },
  {
    q: 'Where should I work the shaping — at the edge, paired, or somewhere else?',
    a: 'For raglans and yokes, paired increases sit at marker positions specified by the pattern. For sleeve tapers, edge increases (1 stitch in from each end) are most common. The calculator only computes spacing — placement comes from the pattern.',
  },
];

const CALCULATORS_INDEX_LIST = [
  {
    title: 'Knitting Gauge Calculator',
    description:
      "Check your swatch against the pattern's target gauge. See whether to size up or down, and how your finished piece will drift at your current gauge.",
    href: '/calculators/gauge',
  },
  {
    title: 'Yarn Substitution Calculator',
    description:
      'Describe the yarn a pattern calls for and rank your stash by how well each option matches on weight, fiber, and yardage.',
    href: '/calculators/yarn-sub',
  },
  {
    title: 'Knitting Size Calculator',
    description:
      'Enter a chest or bust measurement and a fit style; get a recommended size across women, men, children, and baby sizing schemes. Works for gifts or your own projects.',
    // Canonical route. /calculators/gift-size still serves but
    // canonical points at /calculators/size everywhere.
    href: '/calculators/size',
  },
  {
    title: 'Yardage & Skein Estimator',
    description:
      'Estimate how much yarn a project will eat — by garment type, size, and yarn weight — and how many skeins to buy.',
    href: '/calculators/yardage',
  },
  {
    title: 'Row & Round Repeat Calculator',
    description:
      'Work out how many repeats fit between two markers, given total rows/rounds and the repeat length.',
    href: '/calculators/row-repeat',
  },
  {
    title: 'Increase / Decrease Spacing Calculator',
    description:
      'Spread shaping evenly: given start stitches, end stitches, and rows available, get the exact "every Nth row" plan.',
    href: '/calculators/shaping',
  },
];

function faqPage(faqs: Faq[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
}

export const CALCULATORS_INDEX_JSONLD: Array<Record<string, unknown>> = [
  {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Free Knitting Calculators',
    url: 'https://rowlyknit.com/calculators',
    description: 'Free knitting calculators for gauge, sizing, and yarn substitution.',
    hasPart: CALCULATORS_INDEX_LIST.map((c) => ({
      '@type': 'WebApplication',
      name: c.title,
      url: `https://rowlyknit.com${c.href}`,
      description: c.description,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Any',
      offers: FREE_OFFER,
    })),
    publisher: ORG_PUBLISHER,
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [BREADCRUMB_HOME, BREADCRUMB_CALCULATORS],
  },
];

export const GAUGE_CALCULATOR_JSONLD: Array<Record<string, unknown>> = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Knitting Gauge Calculator',
    url: 'https://rowlyknit.com/calculators/gauge',
    description:
      "Compare your knitted swatch against a pattern's target gauge. See whether you're on-gauge and how the finished piece will drift.",
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any',
    offers: FREE_OFFER,
    publisher: ORG_PUBLISHER,
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      BREADCRUMB_HOME,
      BREADCRUMB_CALCULATORS,
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Gauge Calculator',
        item: 'https://rowlyknit.com/calculators/gauge',
      },
    ],
  },
  faqPage(GAUGE_FAQS),
];

export const SIZE_CALCULATOR_JSONLD: Array<Record<string, unknown>> = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Knitting Size Calculator',
    url: 'https://rowlyknit.com/calculators/size',
    description:
      'Enter a chest or bust measurement and a fit style; get a recommended size across women, men, children, and baby schemes.',
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any',
    offers: FREE_OFFER,
    publisher: ORG_PUBLISHER,
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      BREADCRUMB_HOME,
      BREADCRUMB_CALCULATORS,
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Size Calculator',
        item: 'https://rowlyknit.com/calculators/size',
      },
    ],
  },
  faqPage(GIFT_SIZE_FAQS),
];

/**
 * Backwards-compat export. The constant was historically named
 * `GIFT_SIZE_CALCULATOR_JSONLD`; new code should use
 * `SIZE_CALCULATOR_JSONLD`. Both still emit canonical URLs at
 * `/calculators/size`.
 */
export const GIFT_SIZE_CALCULATOR_JSONLD = SIZE_CALCULATOR_JSONLD;

/**
 * Helper for the three Sprint-1 tools (yardage, row-repeat, shaping)
 * which share the same JSON-LD shape — WebApplication + breadcrumb +
 * FAQPage. Less copy-paste than the gauge/size payloads above.
 */
function buildToolJsonLd(
  toolPath: string,
  name: string,
  description: string,
  faqs: Faq[],
): Array<Record<string, unknown>> {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name,
      url: `https://rowlyknit.com${toolPath}`,
      description,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Any',
      offers: FREE_OFFER,
      publisher: ORG_PUBLISHER,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        BREADCRUMB_HOME,
        BREADCRUMB_CALCULATORS,
        {
          '@type': 'ListItem',
          position: 3,
          name,
          item: `https://rowlyknit.com${toolPath}`,
        },
      ],
    },
    faqPage(faqs),
  ];
}

export const YARDAGE_CALCULATOR_JSONLD: Array<Record<string, unknown>> = buildToolJsonLd(
  '/calculators/yardage',
  'Yardage & Skein Estimator',
  'Estimate how much yarn a project will eat — by garment type, size, and yarn weight — and how many skeins to buy.',
  YARDAGE_FAQS,
);

export const ROW_REPEAT_CALCULATOR_JSONLD: Array<Record<string, unknown>> = buildToolJsonLd(
  '/calculators/row-repeat',
  'Row & Round Repeat Calculator',
  'Work out how many repeats fit between two markers, given total rows/rounds and the repeat length.',
  ROW_REPEAT_FAQS,
);

export const SHAPING_CALCULATOR_JSONLD: Array<Record<string, unknown>> = buildToolJsonLd(
  '/calculators/shaping',
  'Increase / Decrease Spacing Calculator',
  'Spread shaping evenly: given start stitches, end stitches, and rows available, get the exact "every Nth row" plan.',
  SHAPING_FAQS,
);
