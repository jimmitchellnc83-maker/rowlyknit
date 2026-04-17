import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Clear existing data in FK-safe order
  await knex('ref_yarn_weight_categories').del();
  await knex('ref_circular_lengths').del();
  await knex('ref_tool_sizes').del();

  // ── Knitting needles ──────────────────────────────────────────
  // All knitting needle sizes use tool_category='knitting_needle_straight'
  // as the base (they apply to all knitting needle types).

  const knittingNeedles = [
    { mm: 1.0,   us: '000',   uk: '19' },
    { mm: 1.25,  us: '00',    uk: '18' },
    { mm: 1.5,   us: '1',     uk: '17' },
    { mm: 1.75,  us: '2',     uk: '16' },
    { mm: 2.0,   us: '0',     uk: '14' },
    { mm: 2.25,  us: '1',     uk: '13' },
    { mm: 2.5,   us: '1.5',   uk: null },
    { mm: 2.75,  us: '2',     uk: '12' },
    { mm: 3.0,   us: '2.5',   uk: '11' },
    { mm: 3.25,  us: '3',     uk: '10' },
    { mm: 3.5,   us: '4',     uk: '9' },
    { mm: 3.75,  us: '5',     uk: '8' },
    { mm: 4.0,   us: '6',     uk: '8' },
    { mm: 4.5,   us: '7',     uk: '7' },
    { mm: 5.0,   us: '8',     uk: '6' },
    { mm: 5.5,   us: '9',     uk: '5' },
    { mm: 6.0,   us: '10',    uk: '4' },
    { mm: 6.5,   us: '10.5',  uk: '3' },
    { mm: 7.0,   us: '10.75', uk: '1' },
    { mm: 7.5,   us: null,    uk: '0' },
    { mm: 8.0,   us: '11',    uk: '0' },
    { mm: 9.0,   us: '13',    uk: '00' },
    { mm: 10.0,  us: '15',    uk: '000' },
    { mm: 12.0,  us: '17',    uk: null },
    { mm: 15.0,  us: '19',    uk: null },
    { mm: 19.0,  us: '35',    uk: null },
    { mm: 25.0,  us: '50',    uk: null },
  ];

  await knex('ref_tool_sizes').insert(
    knittingNeedles.map((n, i) => ({
      craft_type: 'knitting',
      tool_category: 'knitting_needle_straight',
      hook_family: null,
      size_mm: n.mm,
      us_label: n.us,
      uk_label: n.uk,
      letter_label: null,
      sort_order: i,
    })),
  );

  console.log(`  Seeded ${knittingNeedles.length} knitting needle sizes`);

  // ── Crochet hooks ─────────────────────────────────────────────
  // Steel hooks (family='steel') -> tool_category='crochet_hook_steel'
  // Standard hooks (family='standard') -> tool_category='crochet_hook_standard'

  const crochetHooks = [
    // Steel hooks
    { mm: 0.6,   us: 'Steel 14', uk: null,  letter: null, family: 'steel' as const },
    { mm: 0.75,  us: 'Steel 12', uk: null,  letter: null, family: 'steel' as const },
    { mm: 0.85,  us: 'Steel 10', uk: null,  letter: null, family: 'steel' as const },
    { mm: 0.9,   us: 'Steel 8',  uk: null,  letter: null, family: 'steel' as const },
    { mm: 1.1,   us: 'Steel 7',  uk: null,  letter: null, family: 'steel' as const },
    { mm: 1.4,   us: 'Steel 6',  uk: null,  letter: null, family: 'steel' as const },
    { mm: 1.5,   us: 'Steel 5',  uk: null,  letter: null, family: 'steel' as const },
    { mm: 1.65,  us: 'Steel 4',  uk: null,  letter: null, family: 'steel' as const },
    { mm: 1.8,   us: 'Steel 3',  uk: null,  letter: null, family: 'steel' as const },
    { mm: 1.9,   us: 'Steel 2',  uk: null,  letter: null, family: 'steel' as const },
    { mm: 2.0,   us: 'Steel 1',  uk: '14',  letter: null, family: 'steel' as const },
    { mm: 2.1,   us: 'Steel 0',  uk: null,  letter: null, family: 'steel' as const },
    // Standard hooks
    { mm: 2.25,  us: 'B/1',     uk: '13',  letter: 'B', family: 'standard' as const },
    { mm: 2.75,  us: 'C/2',     uk: '12',  letter: 'C', family: 'standard' as const },
    { mm: 3.0,   us: null,       uk: '11',  letter: null, family: 'standard' as const },
    { mm: 3.25,  us: 'D/3',     uk: '10',  letter: 'D', family: 'standard' as const },
    { mm: 3.5,   us: 'E/4',     uk: '9',   letter: 'E', family: 'standard' as const },
    { mm: 3.75,  us: 'F/5',     uk: '8',   letter: 'F', family: 'standard' as const },
    { mm: 4.0,   us: 'G/6',     uk: '8',   letter: 'G', family: 'standard' as const },
    { mm: 4.5,   us: '7',        uk: '7',   letter: null, family: 'standard' as const },
    { mm: 5.0,   us: 'H/8',     uk: '6',   letter: 'H', family: 'standard' as const },
    { mm: 5.5,   us: 'I/9',     uk: '5',   letter: 'I', family: 'standard' as const },
    { mm: 6.0,   us: 'J/10',    uk: '4',   letter: 'J', family: 'standard' as const },
    { mm: 6.5,   us: 'K/10.5',  uk: '3',   letter: 'K', family: 'standard' as const },
    { mm: 8.0,   us: 'L/11',    uk: '0',   letter: 'L', family: 'standard' as const },
    { mm: 9.0,   us: 'M/13',    uk: null,  letter: 'M', family: 'standard' as const },
    { mm: 10.0,  us: 'N/15',    uk: '00',  letter: 'N', family: 'standard' as const },
    { mm: 11.5,  us: 'P/16',    uk: null,  letter: 'P', family: 'standard' as const },
    { mm: 15.75, us: 'Q',        uk: null,  letter: 'Q', family: 'standard' as const },
    { mm: 19.0,  us: 'S',        uk: null,  letter: 'S', family: 'standard' as const },
  ];

  await knex('ref_tool_sizes').insert(
    crochetHooks.map((h, i) => ({
      craft_type: 'crochet',
      tool_category: h.family === 'steel' ? 'crochet_hook_steel' : 'crochet_hook_standard',
      hook_family: h.family,
      size_mm: h.mm,
      us_label: h.us,
      uk_label: h.uk,
      letter_label: h.letter,
      sort_order: i,
    })),
  );

  console.log(`  Seeded ${crochetHooks.length} crochet hook sizes`);

  // ── Circular cable lengths ────────────────────────────────────

  const cableLengths = [
    { lengthMm: 228.6 },
    { lengthMm: 304.8 },
    { lengthMm: 406.4 },
    { lengthMm: 508.0 },
    { lengthMm: 609.6 },
    { lengthMm: 736.6 },
    { lengthMm: 812.8 },
    { lengthMm: 914.4 },
    { lengthMm: 1016.0 },
    { lengthMm: 1193.8 },
    { lengthMm: 1524.0 },
  ];

  await knex('ref_circular_lengths').insert(
    cableLengths.map((c, i) => ({
      length_mm: c.lengthMm,
      sort_order: i,
    })),
  );

  console.log(`  Seeded ${cableLengths.length} circular cable lengths`);

  // ── Yarn weight categories ────────────────────────────────────

  const yarnWeights = [
    {
      number: 0, name: 'Lace',
      aliases: ['lace', 'fingering 10-count', 'thread'],
      wpi_min: 30, wpi_max: 40,
      knit_gauge_4in_min: 33, knit_gauge_4in_max: 40,
      crochet_gauge_4in_min: 32, crochet_gauge_4in_max: 42,
      needle_mm_min: 1.5, needle_mm_max: 2.25,
      hook_mm_min: 1.5, hook_mm_max: 2.25,
      advisory_only: false,
    },
    {
      number: 1, name: 'Super Fine',
      aliases: ['super fine', 'fingering', 'sock', 'baby'],
      wpi_min: 14, wpi_max: 30,
      knit_gauge_4in_min: 27, knit_gauge_4in_max: 32,
      crochet_gauge_4in_min: 21, crochet_gauge_4in_max: 32,
      needle_mm_min: 2.25, needle_mm_max: 3.25,
      hook_mm_min: 2.25, hook_mm_max: 3.5,
      advisory_only: false,
    },
    {
      number: 2, name: 'Fine',
      aliases: ['fine', 'sport', 'baby'],
      wpi_min: 12, wpi_max: 18,
      knit_gauge_4in_min: 23, knit_gauge_4in_max: 26,
      crochet_gauge_4in_min: 16, crochet_gauge_4in_max: 20,
      needle_mm_min: 3.25, needle_mm_max: 3.75,
      hook_mm_min: 3.5, hook_mm_max: 4.5,
      advisory_only: false,
    },
    {
      number: 3, name: 'Light',
      aliases: ['light', 'DK', 'light worsted'],
      wpi_min: 11, wpi_max: 15,
      knit_gauge_4in_min: 21, knit_gauge_4in_max: 24,
      crochet_gauge_4in_min: 12, crochet_gauge_4in_max: 17,
      needle_mm_min: 3.75, needle_mm_max: 4.5,
      hook_mm_min: 4.5, hook_mm_max: 5.5,
      advisory_only: false,
    },
    {
      number: 4, name: 'Medium',
      aliases: ['medium', 'worsted', 'afghan', 'aran'],
      wpi_min: 9, wpi_max: 12,
      knit_gauge_4in_min: 16, knit_gauge_4in_max: 20,
      crochet_gauge_4in_min: 11, crochet_gauge_4in_max: 14,
      needle_mm_min: 4.5, needle_mm_max: 5.5,
      hook_mm_min: 5.5, hook_mm_max: 6.5,
      advisory_only: false,
    },
    {
      number: 5, name: 'Bulky',
      aliases: ['bulky', 'chunky', 'craft', 'rug'],
      wpi_min: 7, wpi_max: 10,
      knit_gauge_4in_min: 12, knit_gauge_4in_max: 15,
      crochet_gauge_4in_min: 8, crochet_gauge_4in_max: 11,
      needle_mm_min: 5.5, needle_mm_max: 8.0,
      hook_mm_min: 6.5, hook_mm_max: 9.0,
      advisory_only: false,
    },
    {
      number: 6, name: 'Super Bulky',
      aliases: ['super bulky', 'roving'],
      wpi_min: 5, wpi_max: 8,
      knit_gauge_4in_min: 7, knit_gauge_4in_max: 11,
      crochet_gauge_4in_min: 5, crochet_gauge_4in_max: 9,
      needle_mm_min: 8.0, needle_mm_max: 12.75,
      hook_mm_min: 9.0, hook_mm_max: 15.0,
      advisory_only: false,
    },
    {
      number: 7, name: 'Jumbo',
      aliases: ['jumbo'],
      wpi_min: 1, wpi_max: 6,
      knit_gauge_4in_min: null, knit_gauge_4in_max: 6,
      crochet_gauge_4in_min: null, crochet_gauge_4in_max: 5,
      needle_mm_min: 12.75, needle_mm_max: null,
      hook_mm_min: 15.0, hook_mm_max: null,
      advisory_only: false,
    },
  ];

  await knex('ref_yarn_weight_categories').insert(
    yarnWeights.map((w) => ({
      number: w.number,
      name: w.name,
      aliases: `{${w.aliases.map((a) => `"${a}"`).join(',')}}`,
      wpi_min: w.wpi_min,
      wpi_max: w.wpi_max,
      knit_gauge_4in_min: w.knit_gauge_4in_min,
      knit_gauge_4in_max: w.knit_gauge_4in_max,
      crochet_gauge_4in_min: w.crochet_gauge_4in_min,
      crochet_gauge_4in_max: w.crochet_gauge_4in_max,
      needle_mm_min: w.needle_mm_min,
      needle_mm_max: w.needle_mm_max,
      hook_mm_min: w.hook_mm_min,
      hook_mm_max: w.hook_mm_max,
      advisory_only: w.advisory_only,
    })),
  );

  console.log(`  Seeded ${yarnWeights.length} yarn weight categories`);
}
