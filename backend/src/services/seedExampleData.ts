import type { Knex } from 'knex';
import db from '../config/database';
import logger from '../config/logger';

/**
 * Seed a realistic showcase dataset for a newly-registered user.
 *
 * Creates 8 yarns, 6 tools, 4 patterns, 1 recipient, and 3 projects — one of
 * which is fully wired up with a Panel Mode group, counters, magic markers,
 * and a scatter of past knitting sessions so the dashboard heatmap isn't
 * empty. Everything is flagged `is_example = true` so the user can nuke it
 * in one tap from Profile.
 *
 * Idempotent: if `users.examples_seeded_at` is already set, does nothing.
 * Wrap-in-transaction so a failure halfway through doesn't leave orphans.
 */

interface SeedResult {
  yarns: number;
  tools: number;
  patterns: number;
  recipients: number;
  projects: number;
  counters: number;
  panelGroups: number;
  panels: number;
  panelRows: number;
  magicMarkers: number;
  sessions: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function seedExampleDataForUser(userId: string): Promise<SeedResult | null> {
  const user = await db('users').where({ id: userId }).first();
  if (!user) {
    logger.warn(`[seed] user ${userId} not found`);
    return null;
  }
  if (user.examples_seeded_at) {
    logger.info(`[seed] user ${userId} already seeded at ${user.examples_seeded_at} — skipping`);
    return null;
  }

  const result: SeedResult = {
    yarns: 0,
    tools: 0,
    patterns: 0,
    recipients: 0,
    projects: 0,
    counters: 0,
    panelGroups: 0,
    panels: 0,
    panelRows: 0,
    magicMarkers: 0,
    sessions: 0,
  };

  await db.transaction(async (trx) => {
    // ---------- Yarn stash (8 skeins across weights) ----------
    const yarnRows = await trx('yarn')
      .insert(yarnSeeds(userId))
      .returning('id');
    result.yarns = yarnRows.length;
    const yarnIds = yarnRows.map((r: any) => r.id as string);
    const tealYarn = yarnIds[1];
    const rustYarn = yarnIds[2];
    const creamYarn = yarnIds[3];

    // ---------- Tools ----------
    const toolRows = await trx('tools')
      .insert(toolSeeds(userId))
      .returning('id');
    result.tools = toolRows.length;
    const [circular45, dpn375, circular50] = toolRows.map((r: any) => r.id);

    // ---------- Patterns ----------
    const patternRows = await trx('patterns')
      .insert(patternSeeds(userId))
      .returning('id');
    result.patterns = patternRows.length;
    const [harvestPattern] = patternRows.map((r: any) => r.id as string);

    // ---------- Recipients ----------
    const recipientRows = await trx('recipients')
      .insert(recipientSeeds(userId))
      .returning('id');
    result.recipients = recipientRows.length;
    const [recipientId] = recipientRows.map((r: any) => r.id);

    // ---------- Project 1: "Harvest Pullover for Emma" (showcase) ----------
    const [project1] = await trx('projects')
      .insert({
        user_id: userId,
        name: 'Harvest Pullover for Emma',
        description:
          'Rust-coloured raglan pullover using Brooklyn Tweed Shelter. Panel Mode tracks the cable + seed stitch combo on the body.',
        status: 'active',
        project_type: 'sweater',
        start_date: new Date(Date.now() - 21 * DAY_MS),
        notes: 'Using 5.0mm needles for gauge match. Modified sleeve length +1 inch.',
        metadata: JSON.stringify({
          gauge: { sts_per_4in: 18, rows_per_4in: 24 },
          target_size: 'M',
        }),
        tags: JSON.stringify(['sweater', 'cables', 'gift']),
        progress_percentage: 45,
        is_example: true,
        created_at: new Date(Date.now() - 21 * DAY_MS),
        updated_at: new Date(),
      })
      .returning('id');
    result.projects += 1;

    await trx('projects')
      .where({ id: project1.id })
      .update({ recipient_id: recipientId })
      .catch(() => {
        // recipient_id column may not exist across all migrations; swallow.
      });

    await trx('project_patterns').insert({
      project_id: project1.id,
      pattern_id: harvestPattern,
      modifications: 'Sleeves +1 inch, neckline -2 rows.',
    });
    await trx('project_yarn').insert({
      project_id: project1.id,
      yarn_id: rustYarn,
      skeins_used: 3,
      yards_used: 420,
    });
    await trx('project_tools').insert({
      project_id: project1.id,
      tool_id: circular50,
    });

    // Counters on project 1
    const counterRows = await trx('counters')
      .insert([
        {
          project_id: project1.id,
          name: 'Body row',
          type: 'row',
          current_value: 47,
          target_value: 120,
          increment_by: 1,
          min_value: 0,
          sort_order: 0,
          notes: 'Main row counter for the body.',
        },
        {
          project_id: project1.id,
          name: 'Sleeve row',
          type: 'row',
          current_value: 12,
          target_value: 80,
          increment_by: 1,
          min_value: 0,
          sort_order: 1,
          notes: 'Started the first sleeve last weekend.',
        },
      ])
      .returning('id');
    result.counters += counterRows.length;
    const [bodyCounterId] = counterRows.map((r: any) => r.id);

    // Counter history — a few recent events for the heatmap to look real
    for (let i = 0; i < 8; i++) {
      await trx('counter_history').insert({
        counter_id: bodyCounterId,
        old_value: 47 - (i + 1),
        new_value: 47 - i,
        action: 'increment',
        created_at: new Date(Date.now() - i * 8 * 60 * 60 * 1000),
      });
    }

    // Panel group "Body" with 3 panels
    const [panelGroup] = await trx('panel_groups')
      .insert({
        project_id: project1.id,
        name: 'Body',
        master_counter_id: bodyCounterId,
        sort_order: 0,
        display_settings: JSON.stringify({}),
      })
      .returning('id');
    result.panelGroups += 1;

    const panelRowsInserted = await trx('panels')
      .insert([
        {
          panel_group_id: panelGroup.id,
          name: 'Cable A',
          repeat_length: 10,
          row_offset: 0,
          sort_order: 0,
          display_color: '#B91C1C',
          notes: 'Classic 10-row cable twist.',
        },
        {
          panel_group_id: panelGroup.id,
          name: 'Seed Stitch Border',
          repeat_length: 2,
          row_offset: 0,
          sort_order: 1,
          display_color: '#F59E0B',
        },
        {
          panel_group_id: panelGroup.id,
          name: 'Moss Stitch Center',
          repeat_length: 4,
          row_offset: 0,
          sort_order: 2,
          display_color: '#EC4899',
        },
      ])
      .returning('id');
    result.panels += panelRowsInserted.length;
    const [cableAId, seedId, mossId] = panelRowsInserted.map((r: any) => r.id);

    const allPanelRows: Array<{
      panel_id: string;
      row_number: number;
      instruction: string;
    }> = [];
    // Cable A (10-row repeat)
    const cableAInstructions = [
      'K2, P2, K6, P2, K2',
      'P2, K2, P6, K2, P2',
      'K2, P2, C6F, P2, K2',
      'P2, K2, P6, K2, P2',
      'K2, P2, K6, P2, K2',
      'P2, K2, P6, K2, P2',
      'K2, P2, K6, P2, K2',
      'P2, K2, P6, K2, P2',
      'K2, P2, K6, P2, K2',
      'P2, K2, P6, K2, P2',
    ];
    cableAInstructions.forEach((instr, idx) => {
      allPanelRows.push({ panel_id: cableAId, row_number: idx + 1, instruction: instr });
    });
    // Seed stitch (2-row)
    allPanelRows.push({ panel_id: seedId, row_number: 1, instruction: '*K1, P1; repeat from *' });
    allPanelRows.push({ panel_id: seedId, row_number: 2, instruction: '*P1, K1; repeat from *' });
    // Moss stitch (4-row)
    allPanelRows.push({ panel_id: mossId, row_number: 1, instruction: '*K1, P1; repeat from *' });
    allPanelRows.push({ panel_id: mossId, row_number: 2, instruction: '*K1, P1; repeat from *' });
    allPanelRows.push({ panel_id: mossId, row_number: 3, instruction: '*P1, K1; repeat from *' });
    allPanelRows.push({ panel_id: mossId, row_number: 4, instruction: '*P1, K1; repeat from *' });

    await trx('panel_rows').insert(
      allPanelRows.map((r) => ({
        panel_id: r.panel_id,
        row_number: r.row_number,
        instruction: r.instruction,
        metadata: JSON.stringify({}),
      })),
    );
    result.panelRows += allPanelRows.length;

    // Magic markers on project 1 (row 52 one-off + repeat every 10)
    const markerRows = await trx('magic_markers')
      .insert(magicMarkerSeeds(project1.id, bodyCounterId))
      .returning('id')
      .catch(() => [] as any[]);
    result.magicMarkers += Array.isArray(markerRows) ? markerRows.length : 0;

    // Knitting sessions — 8 scattered over the last 3 weeks
    const sessionInserts: any[] = [];
    for (let i = 0; i < 8; i++) {
      const start = new Date(Date.now() - (i * 2 + 1) * DAY_MS - Math.random() * 4 * 60 * 60 * 1000);
      const duration = 30 * 60 + Math.floor(Math.random() * 90 * 60); // 30-120 min
      const end = new Date(start.getTime() + duration * 1000);
      sessionInserts.push({
        project_id: project1.id,
        user_id: userId,
        start_time: start,
        end_time: end,
        duration_seconds: duration,
        rows_completed: 2 + Math.floor(Math.random() * 8),
        mood: ['productive', 'relaxed', 'relaxed', 'productive'][i % 4],
        location: ['home', 'cafe'][i % 2],
      });
    }
    const sessionRows = await trx('knitting_sessions').insert(sessionInserts).returning('id');
    result.sessions += sessionRows.length;

    // ---------- Project 2: "Baby blanket" (in progress, simpler) ----------
    const [project2] = await trx('projects')
      .insert({
        user_id: userId,
        name: 'Cotton baby blanket',
        description:
          'Simple squishy cotton blanket for cousin\'s baby shower. No pattern — just working moss stitch until it\'s big enough.',
        status: 'active',
        project_type: 'blanket',
        start_date: new Date(Date.now() - 7 * DAY_MS),
        notes: 'Going for ~30×30 inches finished. Saving half a skein for a matching hat.',
        metadata: JSON.stringify({ target_size: '30x30in' }),
        tags: JSON.stringify(['baby', 'gift', 'beginner-friendly']),
        progress_percentage: 25,
        is_example: true,
      })
      .returning('id');
    result.projects += 1;
    await trx('project_yarn').insert({
      project_id: project2.id,
      yarn_id: creamYarn,
      skeins_used: 1,
    });
    await trx('project_tools').insert({ project_id: project2.id, tool_id: circular45 });

    // ---------- Project 3: "Completed socks" (done, rated) ----------
    const [project3] = await trx('projects')
      .insert({
        user_id: userId,
        name: 'Teal ankle socks',
        description:
          'First finished pair — teal fingering with 2x2 rib cuff. Surprisingly fast knit.',
        status: 'completed',
        project_type: 'socks',
        start_date: new Date(Date.now() - 60 * DAY_MS),
        target_completion_date: new Date(Date.now() - 30 * DAY_MS),
        actual_completion_date: new Date(Date.now() - 28 * DAY_MS),
        notes: 'Used afterthought heel. Fits perfectly. Making another pair in burgundy.',
        metadata: JSON.stringify({
          gauge: { sts_per_4in: 32, rows_per_4in: 44 },
          target_size: 'W US 8',
        }),
        tags: JSON.stringify(['socks', 'completed']),
        progress_percentage: 100,
        is_example: true,
      })
      .returning('id');
    result.projects += 1;
    await trx('project_yarn').insert({
      project_id: project3.id,
      yarn_id: tealYarn,
      skeins_used: 2,
      yards_used: 380,
    });
    await trx('project_tools').insert({ project_id: project3.id, tool_id: dpn375 });

    // Rating on project 3 — table is project_ratings (migration 52)
    await trx('project_ratings')
      .insert({
        project_id: project3.id,
        user_id: userId,
        rating: 5,
        comment: 'So cozy. Will make these again in every colour.',
      })
      .catch(() => {
        // project_ratings table added in migration 052 — should exist. Swallow to be safe.
      });

    // Mark the user as seeded so register doesn't double-seed.
    await trx('users').where({ id: userId }).update({
      examples_seeded_at: new Date(),
      updated_at: new Date(),
    });
  });

  logger.info(`[seed] seeded example data for user ${userId}: ${JSON.stringify(result)}`);
  return result;
}

/* ========================================================================
 * Seed data — kept inline for easy editing without crawling a fixtures dir.
 * Ordered so destructured IDs in the transaction map back cleanly.
 * ======================================================================*/

function yarnSeeds(userId: string) {
  const base = { user_id: userId, is_example: true };
  return [
    {
      ...base,
      brand: 'Brooklyn Tweed',
      line: 'Shelter',
      name: 'Wheat',
      color: 'Warm wheat',
      weight: 'worsted',
      fiber_content: '100% American wool',
      yards_total: 140,
      yards_remaining: 140,
      skeins_total: 5,
      skeins_remaining: 5,
      price_per_skein: 15,
      notes: 'Rustic, airy — cables pop beautifully.',
      is_favorite: true,
    },
    {
      ...base,
      brand: 'Madelinetosh',
      line: 'Tosh Merino Light',
      name: 'Teal',
      color: 'Deep teal heathered',
      weight: 'fingering',
      fiber_content: '100% superwash merino',
      yards_total: 420,
      yards_remaining: 40,
      skeins_total: 2,
      skeins_remaining: 0,
      price_per_skein: 28,
      notes: 'Used for completed socks — a bit of the 2nd skein left.',
    },
    {
      ...base,
      brand: 'Brooklyn Tweed',
      line: 'Shelter',
      name: 'Rust',
      color: 'Rust',
      weight: 'worsted',
      fiber_content: '100% American wool',
      yards_total: 140,
      yards_remaining: 280,
      skeins_total: 5,
      skeins_remaining: 2,
      price_per_skein: 15,
      notes: 'Main yarn for the Harvest pullover.',
    },
    {
      ...base,
      brand: 'Lion Brand',
      line: '24/7 Cotton',
      name: 'Cream',
      color: 'Natural cream',
      weight: 'dk',
      fiber_content: '100% mercerized cotton',
      yards_total: 186,
      yards_remaining: 558,
      skeins_total: 3,
      skeins_remaining: 3,
      price_per_skein: 8,
      notes: 'Baby-safe, machine washable.',
    },
    {
      ...base,
      brand: 'Wool and the Gang',
      line: 'Shiny Happy Cotton',
      name: 'Coral',
      color: 'Coral pink',
      weight: 'dk',
      fiber_content: '100% recycled cotton',
      yards_total: 142,
      yards_remaining: 426,
      skeins_total: 3,
      skeins_remaining: 3,
      price_per_skein: 12,
    },
    {
      ...base,
      brand: 'Cascade',
      line: '220',
      name: 'Charcoal heather',
      color: 'Charcoal',
      weight: 'worsted',
      fiber_content: '100% Peruvian wool',
      yards_total: 220,
      yards_remaining: 1320,
      skeins_total: 6,
      skeins_remaining: 6,
      price_per_skein: 10,
    },
    {
      ...base,
      brand: 'Knit Picks',
      line: 'Stroll',
      name: 'Burgundy',
      color: 'Deep burgundy',
      weight: 'fingering',
      fiber_content: '75% superwash merino, 25% nylon',
      yards_total: 231,
      yards_remaining: 924,
      skeins_total: 4,
      skeins_remaining: 4,
      price_per_skein: 5,
      notes: 'Planned for the next pair of socks.',
    },
    {
      ...base,
      brand: 'Berroco',
      line: 'Ultra Alpaca',
      name: 'Mahogany mix',
      color: 'Mahogany',
      weight: 'worsted',
      fiber_content: '50% alpaca, 50% wool',
      yards_total: 215,
      yards_remaining: 645,
      skeins_total: 3,
      skeins_remaining: 3,
      price_per_skein: 13,
    },
  ];
}

function toolSeeds(userId: string) {
  const base = { user_id: userId, is_example: true };
  return [
    {
      ...base,
      type: 'circular',
      name: 'Addi Turbo 4.5mm / US 7 (32")',
      size: 'US 7',
      size_mm: 4.5,
      material: 'metal',
      length: 32,
      brand: 'Addi',
    },
    {
      ...base,
      type: 'dpn',
      name: 'Clover Takumi 3.75mm / US 5 (6")',
      size: 'US 5',
      size_mm: 3.75,
      material: 'bamboo',
      length: 6,
      brand: 'Clover',
    },
    {
      ...base,
      type: 'circular',
      name: 'ChiaoGoo Red Lace 5.0mm / US 8 (40")',
      size: 'US 8',
      size_mm: 5.0,
      material: 'stainless steel',
      length: 40,
      brand: 'ChiaoGoo',
    },
    {
      ...base,
      type: 'straight',
      name: 'Susan Bates 4.0mm / US 6 (10")',
      size: 'US 6',
      size_mm: 4.0,
      material: 'aluminum',
      length: 10,
      brand: 'Susan Bates',
    },
    {
      ...base,
      type: 'accessory',
      name: 'Cable needle set',
      material: 'metal',
      brand: 'Clover',
    },
    {
      ...base,
      type: 'accessory',
      name: 'Stitch markers (pack of 20)',
      material: 'silicone',
    },
  ];
}

function patternSeeds(userId: string) {
  const base = { user_id: userId, is_example: true };
  return [
    {
      ...base,
      name: 'Harvest Pullover',
      description:
        'Worsted-weight raglan pullover with a center cable panel and seed stitch borders. Top-down seamless construction.',
      designer: 'Example Pattern',
      difficulty: 'intermediate',
      category: 'sweater',
      estimated_yardage: 1200,
      notes: 'Sized XS–4XL. Sample in worsted at 18 sts per 4".',
      tags: JSON.stringify(['cables', 'sweater', 'seamless']),
    },
    {
      ...base,
      name: 'Classic Aran Cardigan',
      description:
        'Traditional Aran cardigan with honeycomb, diamond, and cable panels. Beginner-friendly despite the look.',
      designer: 'Example Pattern',
      difficulty: 'intermediate',
      category: 'cardigan',
      estimated_yardage: 1500,
      tags: JSON.stringify(['cables', 'cardigan', 'aran']),
    },
    {
      ...base,
      name: 'Everyday Raglan',
      description:
        'Seamless top-down raglan pullover in any weight. Customisable length + sleeve shaping.',
      designer: 'Example Pattern',
      difficulty: 'beginner',
      category: 'sweater',
      estimated_yardage: 1000,
      tags: JSON.stringify(['raglan', 'seamless', 'beginner']),
    },
    {
      ...base,
      name: 'Afterthought-Heel Socks',
      description:
        'Classic fingering-weight sock with a 2×2 rib cuff and afterthought heel. Great for hand-dyed yarn.',
      designer: 'Example Pattern',
      difficulty: 'intermediate',
      category: 'socks',
      estimated_yardage: 400,
      tags: JSON.stringify(['socks', 'fingering']),
    },
  ];
}

function recipientSeeds(userId: string) {
  return [
    {
      user_id: userId,
      is_example: true,
      first_name: 'Emma',
      last_name: '(example)',
      relationship: 'sister',
      measurements: JSON.stringify({
        chest_in: 36,
        waist_in: 28,
        hip_in: 38,
        arm_length_in: 24,
        head_circumference_in: 22,
      }),
      preferences: JSON.stringify({
        colors: ['warm earth tones', 'rust', 'mustard'],
        disliked_fibers: ['mohair'],
      }),
      clothing_size: 'M',
      notes: 'Example recipient — delete me once you add real people.',
    },
  ];
}

function magicMarkerSeeds(projectId: string, counterId: string) {
  const base = {
    project_id: projectId,
    counter_id: counterId,
    is_active: true,
    priority: 'normal',
    category: 'pattern',
    alert_type: 'notification',
  };
  return [
    {
      ...base,
      name: 'Start armhole decreases',
      trigger_type: 'counter_value',
      trigger_condition: JSON.stringify({ type: 'equals', value: 52 }),
      alert_message: 'Begin armhole shaping — bind off 5 sts each side.',
      start_row: 52,
      end_row: 52,
      repeat_interval: null,
      is_repeating: false,
    },
    {
      ...base,
      name: 'Check sleeve length every 10 rows',
      trigger_type: 'row_interval',
      trigger_condition: JSON.stringify({ type: 'every_n', value: 10 }),
      alert_message: 'Try on the sleeve and measure length.',
      repeat_interval: 10,
      is_repeating: true,
    },
  ];
}

/**
 * Clear every example-tagged row for a user. Child rows (counters, panels,
 * sessions, etc.) cascade from the parent delete. Also wipes the
 * examples_seeded_at timestamp so the user could re-seed via admin tools
 * later if we build that.
 */
export async function clearExampleDataForUser(
  userId: string,
): Promise<SeedResult> {
  const result: SeedResult = {
    yarns: 0,
    tools: 0,
    patterns: 0,
    recipients: 0,
    projects: 0,
    counters: 0,
    panelGroups: 0,
    panels: 0,
    panelRows: 0,
    magicMarkers: 0,
    sessions: 0,
  };

  await db.transaction(async (trx) => {
    // Delete roots — cascades handle children in their own tables.
    const deletedYarns = await trx('yarn')
      .where({ user_id: userId, is_example: true })
      .del();
    result.yarns = deletedYarns;

    const deletedTools = await trx('tools')
      .where({ user_id: userId, is_example: true })
      .del();
    result.tools = deletedTools;

    const deletedPatterns = await trx('patterns')
      .where({ user_id: userId, is_example: true })
      .del();
    result.patterns = deletedPatterns;

    const deletedRecipients = await trx('recipients')
      .where({ user_id: userId, is_example: true })
      .del();
    result.recipients = deletedRecipients;

    // Projects last so their cascades tidy counters/panels/sessions/markers.
    const deletedProjects = await trx('projects')
      .where({ user_id: userId, is_example: true })
      .del();
    result.projects = deletedProjects;

    await trx('users').where({ id: userId }).update({
      examples_cleared_at: new Date(),
      examples_seeded_at: null,
      updated_at: new Date(),
    });
  });

  logger.info(`[seed] cleared example data for user ${userId}: ${JSON.stringify(result)}`);
  return result;
}

/**
 * Count how many example-tagged rows currently exist for a user. Used by
 * the Profile UI to show "Clear N example items" when the button makes sense.
 */
export async function countExampleData(
  userId: string,
): Promise<{ total: number; breakdown: SeedResult }> {
  const [yarns, tools, patterns, recipients, projects] = await Promise.all([
    db('yarn').where({ user_id: userId, is_example: true }).count('* as n').first(),
    db('tools').where({ user_id: userId, is_example: true }).count('* as n').first(),
    db('patterns').where({ user_id: userId, is_example: true }).count('* as n').first(),
    db('recipients').where({ user_id: userId, is_example: true }).count('* as n').first(),
    db('projects').where({ user_id: userId, is_example: true }).count('* as n').first(),
  ]);
  const breakdown: SeedResult = {
    yarns: Number(yarns?.n ?? 0),
    tools: Number(tools?.n ?? 0),
    patterns: Number(patterns?.n ?? 0),
    recipients: Number(recipients?.n ?? 0),
    projects: Number(projects?.n ?? 0),
    counters: 0,
    panelGroups: 0,
    panels: 0,
    panelRows: 0,
    magicMarkers: 0,
    sessions: 0,
  };
  const total =
    breakdown.yarns +
    breakdown.tools +
    breakdown.patterns +
    breakdown.recipients +
    breakdown.projects;
  return { total, breakdown };
}

export { db as _dbForTests };
export type { SeedResult, Knex };
