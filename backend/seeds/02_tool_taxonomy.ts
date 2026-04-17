import type { Knex } from 'knex';

// Weight constants matching the ranking guidance
const WEIGHTS = {
  exact_label: 100,
  prefix_label: 85, // not stored — computed at query time
  keyword: 60,
  search_term: 50,
  subcategory: 25,
  category: 20,
};

const TAXONOMY = {
  categories: [
    {
      id: 'acquisition', label: 'Acquisition',
      subcategories: [
        {
          id: 'source_materials', label: 'Source materials',
          tool_types: [
            { id: 'yarn', label: 'Yarn', applies_to: ['both'], keywords: ['skein', 'ball', 'hank', 'cone', 'fiber'], search_terms: ['yarn', 'skein', 'hank', 'cone', 'fiber'] },
            { id: 'fiber_prep_materials', label: 'Fiber prep materials', applies_to: ['both'], keywords: ['roving', 'batts', 'fiber prep'], search_terms: ['roving', 'batts', 'fiber prep'] },
          ],
        },
      ],
    },
    {
      id: 'yarn_preparation', label: 'Yarn preparation',
      subcategories: [
        {
          id: 'winding_and_skeining', label: 'Winding and skeining',
          tool_types: [
            { id: 'yarn_swift', label: 'Yarn swift', applies_to: ['both'], keywords: ['umbrella swift', 'tabletop swift', 'amish swift', 'swift'], search_terms: ['yarn swift', 'umbrella swift', 'amish swift'] },
            { id: 'ball_cake_winder', label: 'Ball / cake winder', applies_to: ['both'], keywords: ['ball winder', 'cake winder', 'electric winder'], search_terms: ['ball winder', 'cake winder'] },
            { id: 'nostepinne', label: 'Nostepinne', applies_to: ['both'], keywords: ['hand winder', 'noste pinne'], search_terms: ['nostepinne', 'hand winder'] },
            { id: 'niddy_noddy', label: 'Skein winder / niddy noddy', applies_to: ['both'], keywords: ['skein winder', 'niddy noddy'], search_terms: ['skein winder', 'niddy noddy'] },
          ],
        },
        {
          id: 'measuring_and_conditioning', label: 'Measuring and conditioning',
          tool_types: [
            { id: 'yardage_counter', label: 'Yarn meter / yardage counter', applies_to: ['both'], keywords: ['yardage counter', 'meter counter', 'measuring yarn'], search_terms: ['yardage counter', 'yarn meter'] },
            { id: 'yarn_wash_conditioner', label: 'Yarn wash / conditioner', applies_to: ['both'], keywords: ['wool wash', 'conditioner', 'fiber wash'], search_terms: ['wool wash', 'yarn conditioner'] },
            { id: 'skein_ties_labels', label: 'Skein ties and labels', applies_to: ['both'], keywords: ['skein ties', 'labels', 'tagging yarn'], search_terms: ['skein ties', 'yarn labels'] },
          ],
        },
        {
          id: 'fiber_making', label: 'Fiber making',
          tool_types: [
            { id: 'drop_spindle', label: 'Drop spindle', applies_to: ['both'], keywords: ['suspended spindle', 'drop spindle'], search_terms: ['drop spindle'] },
            { id: 'supported_spindle', label: 'Supported spindle', applies_to: ['both'], keywords: ['supported spindle'], search_terms: ['supported spindle'] },
            { id: 'spinning_wheel', label: 'Spinning wheel', applies_to: ['both'], keywords: ['spinning wheel'], search_terms: ['spinning wheel'] },
          ],
        },
      ],
    },
    {
      id: 'yarn_feeding_tension', label: 'Yarn feeding & tension',
      subcategories: [
        {
          id: 'feed_devices', label: 'Feed devices',
          tool_types: [
            { id: 'yarn_bowl', label: 'Yarn bowl', applies_to: ['both'], keywords: ['ceramic bowl', 'wood bowl', 'yarn holder bowl'], search_terms: ['yarn bowl'] },
            { id: 'yarn_spinner', label: 'Yarn spinner / lazy Susan', applies_to: ['both'], keywords: ['lazy susan', 'spinner', 'rotating yarn holder'], search_terms: ['yarn spinner', 'lazy susan'] },
            { id: 'cone_holder', label: 'Cone holder / stand', applies_to: ['both'], keywords: ['cone stand', 'thread cone holder'], search_terms: ['cone holder', 'cone stand'] },
            { id: 'skein_holder', label: 'Skein / hank holder', applies_to: ['both'], keywords: ['hank holder', 'skein holder'], search_terms: ['skein holder', 'hank holder'] },
          ],
        },
        {
          id: 'tension_guidance', label: 'Tension and guidance',
          tool_types: [
            { id: 'yarn_guide_ring', label: 'Yarn guide ring / thimble', applies_to: ['both'], keywords: ['tension ring', 'guide ring', 'thimble'], search_terms: ['yarn guide ring', 'tension ring'] },
            { id: 'colorwork_guide', label: 'Multi-strand colorwork guide', applies_to: ['both'], keywords: ['colorwork ring', 'strand guide', 'fair isle guide'], search_terms: ['colorwork guide', 'strand guide'] },
            { id: 'wrist_yarn_holder', label: 'Wrist yarn holder / cuff', applies_to: ['both'], keywords: ['yarn cuff', 'wrist holder'], search_terms: ['wrist yarn holder', 'yarn cuff'] },
            { id: 'yarn_carrier_belt', label: 'Belt / apron yarn carrier', applies_to: ['both'], keywords: ['yarn belt', 'apron carrier', 'portable carrier'], search_terms: ['yarn belt', 'yarn carrier'] },
          ],
        },
        {
          id: 'containment_while_using', label: 'Containment while using',
          tool_types: [
            { id: 'yarn_sock', label: 'Yarn sock / cozy', applies_to: ['both'], keywords: ['cake cozy', 'yarn sleeve'], search_terms: ['yarn sock', 'yarn cozy'] },
            { id: 'yarn_cage', label: 'Yarn cage / clip-on holder', applies_to: ['both'], keywords: ['clip holder', 'yarn cage'], search_terms: ['yarn cage', 'clip-on yarn holder'] },
            { id: 'grommet_project_bag', label: 'Project bag with feed holes', applies_to: ['both'], keywords: ['feed grommet bag', 'project bag'], search_terms: ['project bag with feed holes', 'grommet project bag'] },
          ],
        },
      ],
    },
    {
      id: 'making_tools', label: 'Making tools',
      subcategories: [
        {
          id: 'core_tools', label: 'Core tools',
          tool_types: [
            { id: 'knitting_needles', label: 'Knitting needles', applies_to: ['knitting'], keywords: ['single point', 'circular', 'dpn', 'double pointed', 'interchangeable', 'flex needles'], search_terms: ['knitting needles', 'circular needles', 'dpn'] },
            { id: 'crochet_hooks', label: 'Crochet hooks', applies_to: ['crochet'], keywords: ['ergonomic hook', 'steel hook', 'tunisian hook'], search_terms: ['crochet hooks', 'tunisian hooks', 'steel hooks'] },
          ],
        },
        {
          id: 'adjacent_making_tools', label: 'Adjacent making tools',
          tool_types: [
            { id: 'cable_needles', label: 'Cable needles', applies_to: ['knitting'], keywords: ['cable needle'], search_terms: ['cable needles'] },
            { id: 'stitch_holders', label: 'Stitch holders', applies_to: ['both'], keywords: ['stitch holder', 'holding stitches'], search_terms: ['stitch holders'] },
            { id: 'tunisian_cords_stoppers', label: 'Tunisian cords and stoppers', applies_to: ['crochet'], keywords: ['tunisian cord', 'hook stopper'], search_terms: ['tunisian cords', 'tunisian stoppers'] },
          ],
        },
      ],
    },
    {
      id: 'measurement_control', label: 'Measurement & control',
      subcategories: [
        {
          id: 'sizing', label: 'Sizing',
          tool_types: [
            { id: 'needle_hook_gauge', label: 'Needle / hook gauge', applies_to: ['both'], keywords: ['sizer', 'gauge tool'], search_terms: ['needle gauge', 'hook gauge'] },
            { id: 'gauge_ruler', label: 'Gauge ruler / swatch ruler', applies_to: ['both'], keywords: ['swatch ruler', 'gauge measure'], search_terms: ['gauge ruler', 'swatch ruler'] },
          ],
        },
        {
          id: 'tracking', label: 'Tracking',
          tool_types: [
            { id: 'row_counter', label: 'Row counter', applies_to: ['both'], keywords: ['ring counter', 'digital counter', 'click counter'], search_terms: ['row counter', 'stitch counter'] },
            { id: 'stitch_markers', label: 'Stitch markers', applies_to: ['both'], keywords: ['locking marker', 'split marker', 'ring marker'], search_terms: ['stitch markers', 'locking stitch markers'] },
            { id: 'progress_keeper', label: 'Progress keeper', applies_to: ['both'], keywords: ['progress marker', 'removable marker'], search_terms: ['progress keeper', 'progress marker'] },
          ],
        },
        {
          id: 'linear_measurement', label: 'Linear measurement',
          tool_types: [
            { id: 'tape_measure', label: 'Tape measure', applies_to: ['both'], keywords: ['measuring tape'], search_terms: ['tape measure', 'measuring tape'] },
            { id: 'small_ruler', label: 'Small rigid ruler', applies_to: ['both'], keywords: ['mini ruler'], search_terms: ['small ruler', 'mini ruler'] },
          ],
        },
      ],
    },
    {
      id: 'cutting_joining_repair', label: 'Cutting, joining & repair',
      subcategories: [
        {
          id: 'cutting', label: 'Cutting',
          tool_types: [
            { id: 'craft_scissors', label: 'Scissors', applies_to: ['both'], keywords: ['embroidery scissors', 'craft scissors'], search_terms: ['craft scissors', 'embroidery scissors'] },
            { id: 'thread_snips', label: 'Thread snips', applies_to: ['both'], keywords: ['snips', 'yarn snips'], search_terms: ['thread snips', 'yarn snips'] },
          ],
        },
        {
          id: 'joining_and_ends', label: 'Joining and ends',
          tool_types: [
            { id: 'tapestry_needles', label: 'Tapestry / yarn needles', applies_to: ['both'], keywords: ['bent tip needle', 'blunt needle'], search_terms: ['tapestry needles', 'yarn needles'] },
            { id: 'felting_needle_joining', label: 'Felting needle for joining ends', applies_to: ['both'], keywords: ['joining ends', 'felt join'], search_terms: ['felting needle join', 'joining yarn ends'] },
            { id: 'fray_check', label: 'Fray-check / fabric sealant', applies_to: ['both'], keywords: ['sealant', 'fray block'], search_terms: ['fray check', 'fabric sealant'] },
          ],
        },
        {
          id: 'repair', label: 'Repair',
          tool_types: [
            { id: 'latch_fix_it_hook', label: 'Latch hook / fix-it hook', applies_to: ['both'], keywords: ['dropped stitch tool', 'repair hook'], search_terms: ['fix-it hook', 'repair hook'] },
            { id: 'snag_repair_tool', label: 'Snag repair tool', applies_to: ['both'], keywords: ['snag nab it', 'snag fixer'], search_terms: ['snag repair tool', 'snag fixer'] },
          ],
        },
      ],
    },
    {
      id: 'blocking_finishing', label: 'Blocking & finishing',
      subcategories: [
        {
          id: 'surface_prep', label: 'Surface prep',
          tool_types: [
            { id: 'blocking_mats', label: 'Blocking mats', applies_to: ['both'], keywords: ['foam mats', 'interlocking mats'], search_terms: ['blocking mats'] },
            { id: 'blocking_wires', label: 'Blocking wires', applies_to: ['both'], keywords: ['lace wires'], search_terms: ['blocking wires'] },
            { id: 'blocking_pins', label: 'Blocking pins / T-pins', applies_to: ['both'], keywords: ['t pins', 'blocking pins'], search_terms: ['blocking pins', 't pins'] },
            { id: 'blocking_combs', label: 'Blocking combs', applies_to: ['both'], keywords: ['comb blockers'], search_terms: ['blocking combs'] },
          ],
        },
        {
          id: 'moisture_heat', label: 'Moisture and heat',
          tool_types: [
            { id: 'spray_bottle', label: 'Spray bottle', applies_to: ['both'], keywords: ['mist bottle'], search_terms: ['spray bottle'] },
            { id: 'garment_steamer', label: 'Garment steamer / steam iron', applies_to: ['both'], keywords: ['steam iron', 'steamer'], search_terms: ['garment steamer', 'steam iron'] },
          ],
        },
        {
          id: 'shaping_depilling', label: 'Shaping and depilling',
          tool_types: [
            { id: 'sweater_shaver', label: 'Sweater shaver / fabric defuzzer', applies_to: ['both'], keywords: ['defuzzer', 'fabric shaver'], search_terms: ['sweater shaver', 'fabric defuzzer'] },
            { id: 'sweater_comb', label: 'Sweater comb / pumice', applies_to: ['both'], keywords: ['depilling comb', 'pumice'], search_terms: ['sweater comb', 'depilling comb'] },
            { id: 'sock_blockers', label: 'Sock blockers', applies_to: ['both'], keywords: ['sock shaper'], search_terms: ['sock blockers'] },
          ],
        },
      ],
    },
    {
      id: 'storage_organization', label: 'Storage & organization',
      subcategories: [
        {
          id: 'yarn_storage', label: 'Yarn storage',
          tool_types: [
            { id: 'bins_baskets', label: 'Bins and baskets', applies_to: ['both'], keywords: ['storage bin', 'basket'], search_terms: ['yarn bins', 'yarn baskets'] },
            { id: 'clear_modular_boxes', label: 'Clear boxes / modular containers', applies_to: ['both'], keywords: ['clear storage', 'modular box'], search_terms: ['clear yarn storage', 'modular containers'] },
            { id: 'hanging_organizers', label: 'Hanging organizers', applies_to: ['both'], keywords: ['over door organizer', 'wall organizer'], search_terms: ['hanging yarn organizer', 'over door yarn organizer'] },
          ],
        },
        {
          id: 'tool_storage', label: 'Tool storage',
          tool_types: [
            { id: 'needle_hook_cases', label: 'Needle / hook cases and rolls', applies_to: ['both'], keywords: ['hook case', 'needle case', 'roll'], search_terms: ['hook case', 'needle case'] },
            { id: 'notions_pouch', label: 'Notions pouch', applies_to: ['both'], keywords: ['small tools pouch', 'notions bag'], search_terms: ['notions pouch', 'notions bag'] },
            { id: 'project_bags', label: 'Project bags', applies_to: ['both'], keywords: ['drawstring bag', 'zip project bag', 'structured bag'], search_terms: ['project bags', 'knitting project bag', 'crochet project bag'] },
          ],
        },
      ],
    },
    {
      id: 'ergonomics_accessibility', label: 'Ergonomics & accessibility',
      subcategories: [
        {
          id: 'ergonomic_supports', label: 'Ergonomic supports',
          tool_types: [
            { id: 'ergonomic_hooks_needles', label: 'Ergonomic hooks and needles', applies_to: ['both'], keywords: ['soft grip', 'ergonomic handle'], search_terms: ['ergonomic crochet hooks', 'ergonomic knitting needles'] },
            { id: 'grip_covers', label: 'Grip covers / handle add-ons', applies_to: ['both'], keywords: ['grip cover', 'handle grip'], search_terms: ['grip covers', 'handle add-ons'] },
            { id: 'arm_support_cushion', label: 'Lap desk / arm support cushions', applies_to: ['both'], keywords: ['lap desk', 'support cushion'], search_terms: ['arm support cushion', 'lap desk'] },
          ],
        },
        {
          id: 'accessibility_aids', label: 'Accessibility aids',
          tool_types: [
            { id: 'one_handed_knitting_aid', label: 'One-handed knitting aid', applies_to: ['knitting'], keywords: ['one handed knitting', 'needle holder'], search_terms: ['one-handed knitting aid'] },
            { id: 'mounted_tension_device', label: 'Mounted tension device', applies_to: ['both'], keywords: ['table mounted tension', 'arm mounted tension'], search_terms: ['mounted tension device'] },
            { id: 'large_print_tools', label: 'Large-print / high-contrast tools', applies_to: ['both'], keywords: ['high contrast ruler', 'large print gauge'], search_terms: ['large print crafting tools', 'high contrast gauge'] },
          ],
        },
      ],
    },
    {
      id: 'planning_admin', label: 'Planning & admin',
      subcategories: [
        {
          id: 'analog_planning', label: 'Analog planning',
          tool_types: [
            { id: 'pattern_journal', label: 'Notebooks / pattern journals', applies_to: ['both'], keywords: ['pattern notes', 'project journal'], search_terms: ['pattern journal', 'notebook'] },
            { id: 'sticky_notes_highlighters', label: 'Highlighters and sticky notes', applies_to: ['both'], keywords: ['sticky notes', 'highlighters'], search_terms: ['highlighters', 'sticky notes'] },
          ],
        },
        {
          id: 'digital_tools', label: 'Digital tools',
          tool_types: [
            { id: 'pattern_tracking_app', label: 'Pattern / row-tracking apps', applies_to: ['both'], keywords: ['row tracker', 'pattern app'], search_terms: ['pattern tracking app', 'row tracking app'] },
            { id: 'inventory_app', label: 'Inventory apps for yarn and tools', applies_to: ['both'], keywords: ['stash app', 'inventory tracker'], search_terms: ['yarn inventory app', 'stash app'] },
          ],
        },
      ],
    },
  ],
};

const SYNONYMS = [
  { synonym: 'winder', tool_type_id: 'ball_cake_winder' },
  { synonym: 'swift', tool_type_id: 'yarn_swift' },
  { synonym: 'dpn', tool_type_id: 'knitting_needles' },
  { synonym: 'markers', tool_type_id: 'stitch_markers' },
  { synonym: 'snips', tool_type_id: 'thread_snips' },
  { synonym: 'blocking', tool_type_id: 'blocking_mats' },
];

export async function seed(knex: Knex): Promise<void> {
  // Clear existing taxonomy data (order matters for FK constraints)
  await knex('tool_taxonomy_recent_searches').del();
  await knex('tool_taxonomy_search').del();
  await knex('tool_taxonomy_synonyms').del();
  await knex('tool_taxonomy_types').del();
  await knex('tool_taxonomy_subcategories').del();
  await knex('tool_taxonomy_categories').del();

  // Insert categories
  for (let ci = 0; ci < TAXONOMY.categories.length; ci++) {
    const cat = TAXONOMY.categories[ci];
    await knex('tool_taxonomy_categories').insert({
      id: cat.id,
      label: cat.label,
      sort_order: ci,
    });

    // Insert subcategories
    for (let si = 0; si < cat.subcategories.length; si++) {
      const sub = cat.subcategories[si];
      await knex('tool_taxonomy_subcategories').insert({
        id: sub.id,
        category_id: cat.id,
        label: sub.label,
        sort_order: si,
      });

      // Insert tool types
      for (let ti = 0; ti < sub.tool_types.length; ti++) {
        const tt = sub.tool_types[ti];
        await knex('tool_taxonomy_types').insert({
          id: tt.id,
          subcategory_id: sub.id,
          label: tt.label,
          applies_to: tt.applies_to,
          keywords: tt.keywords,
          search_terms: tt.search_terms,
          popularity: 0,
          sort_order: ti,
        });

        // Build denormalized search rows for this tool type
        const searchRows: any[] = [];
        const base = {
          tool_type_id: tt.id,
          tool_label: tt.label,
          subcategory_id: sub.id,
          subcategory_label: sub.label,
          category_id: cat.id,
          category_label: cat.label,
          applies_to: tt.applies_to,
          popularity: 0,
        };

        // exact_label — the tool's own label
        searchRows.push({ ...base, term: tt.label.toLowerCase(), term_type: 'exact_label', base_weight: WEIGHTS.exact_label });

        // keywords
        for (const kw of tt.keywords) {
          searchRows.push({ ...base, term: kw.toLowerCase(), term_type: 'keyword', base_weight: WEIGHTS.keyword });
        }

        // search_terms
        for (const st of tt.search_terms) {
          searchRows.push({ ...base, term: st.toLowerCase(), term_type: 'search_term', base_weight: WEIGHTS.search_term });
        }

        // subcategory name as a search path
        searchRows.push({ ...base, term: sub.label.toLowerCase(), term_type: 'subcategory', base_weight: WEIGHTS.subcategory });

        // category name as a search path
        searchRows.push({ ...base, term: cat.label.toLowerCase(), term_type: 'category', base_weight: WEIGHTS.category });

        await knex('tool_taxonomy_search').insert(searchRows);
      }
    }
  }

  // Insert synonyms + their search rows
  for (const syn of SYNONYMS) {
    await knex('tool_taxonomy_synonyms').insert(syn);

    // Look up the tool type to build the search row
    const tt = await knex('tool_taxonomy_types')
      .join('tool_taxonomy_subcategories', 'tool_taxonomy_types.subcategory_id', 'tool_taxonomy_subcategories.id')
      .join('tool_taxonomy_categories', 'tool_taxonomy_subcategories.category_id', 'tool_taxonomy_categories.id')
      .where('tool_taxonomy_types.id', syn.tool_type_id)
      .select(
        'tool_taxonomy_types.label as tool_label',
        'tool_taxonomy_types.applies_to',
        'tool_taxonomy_types.popularity',
        'tool_taxonomy_subcategories.id as subcategory_id',
        'tool_taxonomy_subcategories.label as subcategory_label',
        'tool_taxonomy_categories.id as category_id',
        'tool_taxonomy_categories.label as category_label'
      )
      .first();

    if (tt) {
      await knex('tool_taxonomy_search').insert({
        tool_type_id: syn.tool_type_id,
        term: syn.synonym.toLowerCase(),
        term_type: 'synonym',
        base_weight: WEIGHTS.keyword, // synonyms rank like keywords
        tool_label: tt.tool_label,
        subcategory_id: tt.subcategory_id,
        subcategory_label: tt.subcategory_label,
        category_id: tt.category_id,
        category_label: tt.category_label,
        applies_to: tt.applies_to,
        popularity: tt.popularity,
      });
    }
  }

  console.log('✓ Tool taxonomy seeded');
}
