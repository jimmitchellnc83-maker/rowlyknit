/**
 * JSON-LD structured-data payloads for the public calculator pages.
 *
 * The same payloads are emitted client-side by `useSeo` in:
 *   - frontend/src/pages/Calculators.tsx          (/calculators)
 *   - frontend/src/pages/GaugeCalculator.tsx      (/calculators/gauge)
 *   - frontend/src/pages/GiftSizeCalculator.tsx   (/calculators/gift-size)
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
    href: '/calculators/gift-size',
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

export const GIFT_SIZE_CALCULATOR_JSONLD: Array<Record<string, unknown>> = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Knitting Size Calculator',
    url: 'https://rowlyknit.com/calculators/gift-size',
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
        item: 'https://rowlyknit.com/calculators/gift-size',
      },
    ],
  },
  faqPage(GIFT_SIZE_FAQS),
];
