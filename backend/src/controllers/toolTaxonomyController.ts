import { Request, Response } from 'express';
import db from '../config/database';
import { sanitizeSearchQuery } from '../utils/inputSanitizer';

const POPULARITY_BOOST = 15;
const DEFAULT_LIMIT = 8;

/**
 * GET /api/tools/taxonomy/search?q=yarn&limit=8&craft=both
 *
 * Weighted autocomplete: queries the denormalized search table and ranks by
 * base_weight (exact_label=100, keyword=60, search_term=50, etc.) plus
 * popularity_boost. De-duplicates by tool_type_id, keeping the highest score.
 */
export async function searchToolTaxonomy(req: Request, res: Response) {
  const rawQ = (req.query.q as string || '').trim();
  const limit = Math.min(Number(req.query.limit) || DEFAULT_LIMIT, 25);
  const craft = req.query.craft as string; // knitting, crochet, or omit for all

  // Empty query → return popular / recent
  if (!rawQ) {
    return popularSuggestions(req, res);
  }

  const q = sanitizeSearchQuery(rawQ).toLowerCase();

  // Build the ranked query:
  // 1. exact match on term = q → base_weight (100 for exact_label)
  // 2. prefix match term LIKE 'q%' → base_weight (capped at 85 for prefix)
  // 3. contains match term LIKE '%q%' → base_weight * 0.7
  // De-duplicate by tool_type_id keeping max score
  let query = db('tool_taxonomy_search')
    .select(
      'tool_type_id',
      'tool_label',
      'subcategory_id',
      'subcategory_label',
      'category_id',
      'category_label',
      'applies_to',
      'popularity',
      db.raw(`
        MAX(
          CASE
            WHEN lower(term) = ? THEN base_weight
            WHEN lower(term) LIKE ? THEN LEAST(base_weight, 85)
            WHEN lower(term) LIKE ? THEN ROUND(base_weight * 0.7)
            ELSE 0
          END
        ) + (popularity * ?) as score
      `, [q, `${q}%`, `%${q}%`, POPULARITY_BOOST])
    )
    .where(function () {
      this.where(db.raw('lower(term) = ?', [q]))
        .orWhere(db.raw('lower(term) LIKE ?', [`${q}%`]))
        .orWhere(db.raw('lower(term) LIKE ?', [`%${q}%`]));
    })
    .groupBy('tool_type_id', 'tool_label', 'subcategory_id', 'subcategory_label', 'category_id', 'category_label', 'applies_to', 'popularity')
    .havingRaw('MAX(CASE WHEN lower(term) = ? THEN base_weight WHEN lower(term) LIKE ? THEN LEAST(base_weight, 85) WHEN lower(term) LIKE ? THEN ROUND(base_weight * 0.7) ELSE 0 END) > 0', [q, `${q}%`, `%${q}%`])
    .orderBy('score', 'desc')
    .limit(limit);

  // Filter by craft if specified
  if (craft && craft !== 'all') {
    query = query.where(function () {
      this.whereRaw("? = ANY(applies_to)", [craft])
        .orWhereRaw("'both' = ANY(applies_to)");
    });
  }

  const results = await query;

  res.json({
    success: true,
    data: {
      query: rawQ,
      suggestions: results.map((r: any) => ({
        toolTypeId: r.tool_type_id,
        label: r.tool_label,
        subcategoryId: r.subcategory_id,
        subcategoryLabel: r.subcategory_label,
        categoryId: r.category_id,
        categoryLabel: r.category_label,
        appliesTo: r.applies_to,
        score: Number(r.score),
      })),
    },
  });
}

/**
 * GET /api/tools/taxonomy/popular
 *
 * Returns recent searches for the current user, then fills remaining slots
 * with globally popular tool types.
 */
async function popularSuggestions(req: Request, res: Response) {
  const userId = req.user?.userId;
  const limit = Math.min(Number(req.query.limit) || DEFAULT_LIMIT, 25);
  const craft = req.query.craft as string;

  const results: any[] = [];

  // Recent searches for this user
  if (userId) {
    let recentQuery = db('tool_taxonomy_recent_searches as rs')
      .join('tool_taxonomy_types as tt', 'rs.tool_type_id', 'tt.id')
      .join('tool_taxonomy_subcategories as sc', 'tt.subcategory_id', 'sc.id')
      .join('tool_taxonomy_categories as c', 'sc.category_id', 'c.id')
      .where('rs.user_id', userId)
      .select(
        'tt.id as tool_type_id',
        'tt.label as tool_label',
        'sc.id as subcategory_id',
        'sc.label as subcategory_label',
        'c.id as category_id',
        'c.label as category_label',
        'tt.applies_to',
        db.raw("'recent' as source")
      )
      .orderBy('rs.searched_at', 'desc')
      .limit(limit);

    if (craft && craft !== 'all') {
      recentQuery = recentQuery.where(function () {
        this.whereRaw("? = ANY(tt.applies_to)", [craft])
          .orWhereRaw("'both' = ANY(tt.applies_to)");
      });
    }

    const recent = await recentQuery;
    results.push(...recent);
  }

  // Fill remaining with popular tool types
  if (results.length < limit) {
    const seenIds = new Set(results.map((r: any) => r.tool_type_id));
    let popularQuery = db('tool_taxonomy_types as tt')
      .join('tool_taxonomy_subcategories as sc', 'tt.subcategory_id', 'sc.id')
      .join('tool_taxonomy_categories as c', 'sc.category_id', 'c.id')
      .select(
        'tt.id as tool_type_id',
        'tt.label as tool_label',
        'sc.id as subcategory_id',
        'sc.label as subcategory_label',
        'c.id as category_id',
        'c.label as category_label',
        'tt.applies_to',
        db.raw("'popular' as source")
      )
      .orderBy('tt.popularity', 'desc')
      .orderBy('c.sort_order', 'asc')
      .orderBy('sc.sort_order', 'asc')
      .orderBy('tt.sort_order', 'asc')
      .limit(limit - results.length);

    if (seenIds.size > 0) {
      popularQuery = popularQuery.whereNotIn('tt.id', [...seenIds]);
    }

    if (craft && craft !== 'all') {
      popularQuery = popularQuery.where(function () {
        this.whereRaw("? = ANY(tt.applies_to)", [craft])
          .orWhereRaw("'both' = ANY(tt.applies_to)");
      });
    }

    const popular = await popularQuery;
    results.push(...popular);
  }

  res.json({
    success: true,
    data: {
      query: '',
      suggestions: results.map((r: any) => ({
        toolTypeId: r.tool_type_id,
        label: r.tool_label,
        subcategoryId: r.subcategory_id,
        subcategoryLabel: r.subcategory_label,
        categoryId: r.category_id,
        categoryLabel: r.category_label,
        appliesTo: r.applies_to,
        source: r.source,
      })),
    },
  });
}

/**
 * POST /api/tools/taxonomy/recent
 * Records a recent search selection for the user.
 */
export async function recordRecentSearch(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { toolTypeId } = req.body;

  if (!toolTypeId) {
    return res.status(400).json({ success: false, message: 'toolTypeId is required' });
  }

  // Upsert: delete old entry for same tool, insert new one
  await db('tool_taxonomy_recent_searches')
    .where({ user_id: userId, tool_type_id: toolTypeId })
    .del();

  await db('tool_taxonomy_recent_searches').insert({
    user_id: userId,
    tool_type_id: toolTypeId,
    searched_at: new Date(),
  });

  // Keep only 20 most recent
  const oldest = await db('tool_taxonomy_recent_searches')
    .where({ user_id: userId })
    .orderBy('searched_at', 'desc')
    .offset(20)
    .limit(1)
    .first();

  if (oldest) {
    await db('tool_taxonomy_recent_searches')
      .where({ user_id: userId })
      .where('searched_at', '<', oldest.searched_at)
      .del();
  }

  // Bump popularity on the tool type
  await db('tool_taxonomy_types')
    .where({ id: toolTypeId })
    .increment('popularity', 1);

  // Update denormalized popularity in search table
  await db('tool_taxonomy_search')
    .where({ tool_type_id: toolTypeId })
    .increment('popularity', 1);

  res.json({ success: true });
}

/**
 * GET /api/tools/taxonomy/categories
 * Returns the full category → subcategory → tool type tree for dropdowns.
 */
export async function getCategories(_req: Request, res: Response) {
  const categories = await db('tool_taxonomy_categories')
    .orderBy('sort_order')
    .select('id', 'label');

  const subcategories = await db('tool_taxonomy_subcategories')
    .orderBy('sort_order')
    .select('id', 'category_id', 'label');

  const toolTypes = await db('tool_taxonomy_types')
    .orderBy('sort_order')
    .select('id', 'subcategory_id', 'label', 'applies_to', 'keywords');

  const tree = categories.map((cat: any) => ({
    ...cat,
    subcategories: subcategories
      .filter((sc: any) => sc.category_id === cat.id)
      .map((sc: any) => ({
        id: sc.id,
        label: sc.label,
        toolTypes: toolTypes
          .filter((tt: any) => tt.subcategory_id === sc.id)
          .map((tt: any) => ({
            id: tt.id,
            label: tt.label,
            appliesTo: tt.applies_to,
            keywords: tt.keywords,
          })),
      })),
  }));

  res.json({ success: true, data: { categories: tree } });
}
