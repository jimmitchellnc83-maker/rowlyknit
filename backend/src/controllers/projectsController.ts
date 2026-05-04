import { Request, Response } from 'express';
import db from '../config/database';
import { NotFoundError, ValidationError } from '../utils/errorHandler';
import { createAuditLog } from '../middleware/auditLog';
import { sanitizeSearchQuery } from '../utils/inputSanitizer';
import {
  getFeasibilityBatch,
  type LightLevel,
} from '../services/feasibilityService';
import { checkNeedleInventory } from '../services/needleInventoryService';
import { duplicateProject as duplicateProjectService } from '../services/projectDuplicationService';
import { materializeLegacyStubForCanonical } from '../services/patternService';

export const ALLOWED_PROJECT_TYPES = [
  'sweater',
  'cardigan',
  'hat',
  'scarf',
  'cowl',
  'shawl',
  'shawlette',
  'socks',
  'mittens',
  'blanket',
  'baby',
  'toy',
  'bag',
  'home',
  'dishcloth',
  'other',
];

/**
 * Return allowed project types for UI/API consumers
 */
export async function getProjectTypes(req: Request, res: Response) {
  res.json({
    success: true,
    data: {
      projectTypes: ALLOWED_PROJECT_TYPES,
    },
  });
}

/**
 * Get all projects for current user
 */
export async function getProjects(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { status, search, favorite, page = 1, limit = 20 } = req.query;

  let query = db('projects')
    .where({ user_id: userId })
    .whereNull('deleted_at');

  if (status) {
    query = query.where({ status });
  }

  if (favorite === 'true') {
    query = query.where({ is_favorite: true });
  }

  if (search) {
    const sanitizedSearch = sanitizeSearchQuery(search as string);
    query = query.where((builder) => {
      builder
        .where('name', 'ilike', `%${sanitizedSearch}%`)
        .orWhere('description', 'ilike', `%${sanitizedSearch}%`);
    });
  }

  const offset = (Number(page) - 1) * Number(limit);
  const [{ count }] = await query.clone().count('* as count');
  const projects = await query
    .orderBy('created_at', 'desc')
    .limit(Number(limit))
    .offset(offset);

  res.json({
    success: true,
    data: {
      projects,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: Number(count),
        totalPages: Math.ceil(Number(count) / Number(limit)),
      },
    },
  });
}

/**
 * Get single project by ID
 */
export async function getProject(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id } = req.params;

  const project = await db('projects')
    .where({ id, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  // Get related data (plus the user's full tool inventory for the
  // needle-inventory cross-check and this user's rating, if either exists).
  const [photos, counters, pieces, patterns, yarn, tools, allUserTools, rating] = await Promise.all([
    db('project_photos').where({ project_id: id }).orderBy('sort_order'),
    db('counters').where({ project_id: id }).orderBy('sort_order'),
    db('project_pieces').where({ project_id: id }).orderBy('sort_order'),
    db('project_patterns as pp')
      .join('patterns as p', 'pp.pattern_id', 'p.id')
      .where({ 'pp.project_id': id })
      .select('p.*', 'pp.modifications'),
    db('project_yarn as py')
      .join('yarn as y', 'py.yarn_id', 'y.id')
      .where({ 'py.project_id': id })
      .select('y.*', 'py.yards_used', 'py.skeins_used'),
    db('project_tools as pt')
      .join('tools as t', 'pt.tool_id', 't.id')
      .where({ 'pt.project_id': id })
      .select('t.*'),
    db('tools').where({ user_id: userId }).whereNull('deleted_at'),
    db('project_ratings').where({ project_id: id, user_id: userId }).first(),
  ]);

  // Enrich each attached legacy pattern with its canonical pattern_models
  // twin id (when one exists). The frontend uses this on Project Detail to
  // route "Resume Knitting" through canonical Make Mode for projects whose
  // patterns have a canonical implementation. Patterns without a twin keep
  // `canonicalPatternModelId: null` and fall through to the legacy
  // project-workspace knitting layout.
  const patternsWithTwins = await enrichPatternsWithCanonicalTwin(patterns, userId);

  const needleCheck = checkNeedleInventory(patterns, allUserTools);

  res.json({
    success: true,
    data: {
      project: {
        ...project,
        photos,
        counters,
        pieces,
        patterns: patternsWithTwins,
        yarn,
        tools,
        needleCheck,
        rating: rating ?? null,
      },
    },
  });
}

/**
 * Look up canonical pattern_models twins for a list of legacy patterns and
 * attach `canonicalPatternModelId` to each row. One DB roundtrip regardless
 * of pattern count. Returns the input list unchanged when empty so callers
 * can use it unconditionally.
 */
async function enrichPatternsWithCanonicalTwin(
  patterns: any[],
  userId: string,
): Promise<any[]> {
  if (!patterns || patterns.length === 0) return patterns;

  const ids = patterns.map((p) => p.id).filter(Boolean);
  if (ids.length === 0) return patterns;

  const twins = await db('pattern_models')
    .whereIn('source_pattern_id', ids)
    .where({ user_id: userId })
    .whereNull('deleted_at')
    .select('id', 'source_pattern_id');

  const twinByLegacy = new Map<string, string>();
  for (const t of twins as Array<{ id: string; source_pattern_id: string }>) {
    twinByLegacy.set(t.source_pattern_id, t.id);
  }

  return patterns.map((p) => ({
    ...p,
    canonicalPatternModelId: twinByLegacy.get(p.id) ?? null,
  }));
}

/**
 * Create new project
 */
export async function createProject(req: Request, res: Response) {
  const userId = req.user!.userId;
  const {
    name,
    description,
    projectType,
    startDate,
    targetCompletionDate,
    notes,
    metadata,
    tags,
  } = req.body;

  if (!name) {
    throw new ValidationError('Project name is required');
  }

  if (projectType && !ALLOWED_PROJECT_TYPES.includes(projectType)) {
    throw new ValidationError(`Project type must be one of: ${ALLOWED_PROJECT_TYPES.join(', ')}`);
  }

  const [project] = await db('projects')
    .insert({
      user_id: userId,
      name,
      description,
      project_type: projectType || ALLOWED_PROJECT_TYPES[0],
      start_date: startDate || null,
      target_completion_date: targetCompletionDate || null,
      notes,
      metadata: metadata ? JSON.stringify(metadata) : '{}',
      tags: tags ? JSON.stringify(tags) : '[]',
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning('*');

  await createAuditLog(req, {
    userId,
    action: 'project_created',
    entityType: 'project',
    entityId: project.id,
    newValues: project,
  });

  res.status(201).json({
    success: true,
    message: 'Project created successfully',
    data: { project },
  });
}

/**
 * Update project
 */
export async function updateProject(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id } = req.params;

  const project = await db('projects')
    .where({ id, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  // Whitelist allowed fields to prevent mass assignment
  const {
    name,
    description,
    projectType,
    startDate,
    targetCompletionDate,
    completedDate: completedAt,
    status,
    notes,
    metadata,
    tags,
    isFavorite,
  } = req.body;

  const updateData: any = {
    updated_at: new Date(),
  };

  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (projectType !== undefined) {
    if (!ALLOWED_PROJECT_TYPES.includes(projectType)) {
      throw new ValidationError(`Project type must be one of: ${ALLOWED_PROJECT_TYPES.join(', ')}`);
    }
    updateData.project_type = projectType;
  }
  if (startDate !== undefined) updateData.start_date = startDate || null;
  if (targetCompletionDate !== undefined) updateData.target_completion_date = targetCompletionDate || null;
  if (completedAt !== undefined) updateData.completed_at = completedAt || null;
  if (status !== undefined) {
    updateData.status = status;

    if (status === 'completed' && updateData.completed_at === undefined) {
      updateData.completed_at = new Date();
    }
  }
  if (notes !== undefined) updateData.notes = notes;
  if (metadata !== undefined) updateData.metadata = JSON.stringify(metadata);
  if (tags !== undefined) updateData.tags = JSON.stringify(tags);
  if (isFavorite !== undefined) updateData.is_favorite = isFavorite;

  const [updatedProject] = await db('projects')
    .where({ id })
    .update(updateData)
    .returning('*');

  await createAuditLog(req, {
    userId,
    action: 'project_updated',
    entityType: 'project',
    entityId: id,
    oldValues: project,
    newValues: updatedProject,
  });

  res.json({
    success: true,
    message: 'Project updated successfully',
    data: { project: updatedProject },
  });
}

/**
 * Delete project (soft delete). Also restores any yarn the project was
 * consuming back to the user's stash in the same transaction — mirrors the
 * credit logic in removeYarnFromProject so deleted projects don't keep
 * yarn "checked out" forever.
 */
export async function deleteProject(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id } = req.params;

  const project = await db('projects')
    .where({ id, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  const yarnsRestored: Array<{
    yarnId: string;
    yardsRestored: number;
    skeinsRestored: number;
  }> = [];

  await db.transaction(async (trx) => {
    // Fetch every yarn currently allocated to this project
    const allocations = await trx('project_yarn').where({ project_id: id });

    for (const allocation of allocations) {
      const yardsUsed = allocation.yards_used || 0;
      const skeinsUsed = allocation.skeins_used || 0;
      const metersReturned = Math.round(yardsUsed * 0.9144 * 100) / 100;

      await trx('yarn')
        .where({ id: allocation.yarn_id })
        .update({
          yards_remaining: trx.raw('yards_remaining + ?', [yardsUsed]),
          remaining_length_m: trx.raw('COALESCE(remaining_length_m, 0) + ?', [metersReturned]),
          skeins_remaining: trx.raw('skeins_remaining + ?', [skeinsUsed]),
          updated_at: new Date(),
        });

      yarnsRestored.push({
        yarnId: allocation.yarn_id,
        yardsRestored: yardsUsed,
        skeinsRestored: skeinsUsed,
      });
    }

    // Drop the project_yarn rows so a future restore of the project doesn't double-count.
    // Note: if we ever introduce undelete, we'll need to snapshot these before deletion.
    await trx('project_yarn').where({ project_id: id }).delete();

    await trx('projects')
      .where({ id })
      .update({
        deleted_at: new Date(),
        updated_at: new Date(),
      });
  });

  await createAuditLog(req, {
    userId,
    action: 'project_deleted',
    entityType: 'project',
    entityId: id,
    oldValues: project,
    newValues: { yarnsRestored },
  });

  res.json({
    success: true,
    message: 'Project deleted successfully',
    data: { yarnsRestored },
  });
}

/**
 * Return per-project feasibility for every linked pattern, plus a per-project
 * aggregate verdict (worst-of across attached patterns). Used by the Projects
 * list to render a single traffic-light chip on each card and by the Dashboard
 * to spot setup gaps. Multi-pattern projects surface the worst attached
 * pattern's status — a project can't be greener than any of its dependencies.
 *
 * Response shape:
 *   - `summaries`: one row per (project, attached pattern) pair, lossless.
 *   - `aggregates`: one row per project with attached pattern(s), keyed for
 *     UI consumers that need a single status per card. `patternIds` lists
 *     every pattern that contributed to the verdict.
 *
 * `summaries` is preserved (not collapsed) so callers can drill in for
 * per-pattern detail without re-fetching.
 */
export async function getProjectsFeasibilitySummary(req: Request, res: Response) {
  const userId = req.user!.userId;

  const projectIds = await db('projects')
    .where({ user_id: userId })
    .whereNull('deleted_at')
    .pluck('id');

  if (projectIds.length === 0) {
    return res.json({ success: true, data: { summaries: [], aggregates: [] } });
  }

  const links = await db('project_patterns')
    .whereIn('project_id', projectIds)
    .orderBy('created_at', 'asc')
    .select('project_id', 'pattern_id');

  const items = links.map((link: { project_id: string; pattern_id: string }) => ({
    projectId: link.project_id,
    patternId: link.pattern_id,
  }));

  const summaries = await getFeasibilityBatch(userId, items);
  const aggregates = aggregateFeasibilityByProject(summaries);

  return res.json({
    success: true,
    data: { summaries, aggregates },
  });
}

/**
 * Reduce per-pattern feasibility summaries to one aggregate row per project.
 * The aggregate status is the worst of all contributing patterns — `red`
 * dominates `yellow` dominates `green`. A project with no patterns produces
 * no aggregate row (callers treat absence as "unknown").
 */
export function aggregateFeasibilityByProject(
  summaries: Array<{ projectId: string; patternId: string; overallStatus: LightLevel }>,
): Array<{ projectId: string; overallStatus: LightLevel; patternIds: string[] }> {
  const byProject = new Map<
    string,
    { statuses: Set<LightLevel>; patternIds: string[] }
  >();

  for (const s of summaries) {
    let entry = byProject.get(s.projectId);
    if (!entry) {
      entry = { statuses: new Set(), patternIds: [] };
      byProject.set(s.projectId, entry);
    }
    entry.statuses.add(s.overallStatus);
    if (!entry.patternIds.includes(s.patternId)) {
      entry.patternIds.push(s.patternId);
    }
  }

  const out: Array<{ projectId: string; overallStatus: LightLevel; patternIds: string[] }> = [];
  for (const [projectId, entry] of byProject.entries()) {
    let status: LightLevel = 'green';
    if (entry.statuses.has('red')) status = 'red';
    else if (entry.statuses.has('yellow')) status = 'yellow';
    out.push({ projectId, overallStatus: status, patternIds: entry.patternIds });
  }
  return out;
}

/**
 * Get project statistics
 */
export async function getProjectStats(req: Request, res: Response) {
  const userId = req.user!.userId;

  const stats = await db('projects')
    .where({ user_id: userId })
    .whereNull('deleted_at')
    .select(
      db.raw("COUNT(*) FILTER (WHERE status = 'active') as active_count"),
      db.raw("COUNT(*) FILTER (WHERE status = 'completed') as completed_count"),
      db.raw("COUNT(*) FILTER (WHERE status = 'paused') as paused_count"),
      db.raw('COUNT(*) as total_count')
    )
    .first();

  res.json({
    success: true,
    data: { stats },
  });
}

/**
 * Add yarn to project with automatic stash deduction
 */
export async function addYarnToProject(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id: projectId } = req.params;
  const { yarnId, yardsUsed = 0, skeinsUsed = 0 } = req.body;

  // Verify project exists and belongs to user
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  // Verify yarn exists and belongs to user
  const yarn = await db('yarn')
    .where({ id: yarnId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!yarn) {
    throw new NotFoundError('Yarn not found');
  }

  // Check if yarn is already added to project
  const existing = await db('project_yarn')
    .where({ project_id: projectId, yarn_id: yarnId })
    .first();

  if (existing) {
    throw new ValidationError('This yarn is already added to the project');
  }

  // Check if sufficient yarn available
  if (yardsUsed > 0 && yarn.yards_remaining < yardsUsed) {
    throw new ValidationError(`Insufficient yarn. Only ${yarn.yards_remaining} yards remaining.`);
  }
  if (skeinsUsed > 0 && yarn.skeins_remaining < skeinsUsed) {
    throw new ValidationError(`Insufficient yarn. Only ${yarn.skeins_remaining} skeins remaining.`);
  }

  // Begin transaction
  await db.transaction(async (trx) => {
    // Add yarn to project
    await trx('project_yarn').insert({
      project_id: projectId,
      yarn_id: yarnId,
      yards_used: yardsUsed,
      skeins_used: skeinsUsed,
    });

    // Deduct from stash (both legacy yards and normalized meters)
    const metersUsed = Math.round(yardsUsed * 0.9144 * 100) / 100;
    await trx('yarn')
      .where({ id: yarnId })
      .update({
        yards_remaining: trx.raw('yards_remaining - ?', [yardsUsed]),
        remaining_length_m: trx.raw('GREATEST(0, COALESCE(remaining_length_m, 0) - ?)', [metersUsed]),
        skeins_remaining: trx.raw('skeins_remaining - ?', [skeinsUsed]),
        updated_at: new Date(),
      });

    // Check if yarn is now low on stock
    const updatedYarn = await trx('yarn')
      .where({ id: yarnId })
      .first();

    if (updatedYarn.low_stock_alert && updatedYarn.yards_remaining <= (updatedYarn.low_stock_threshold || 100)) {
      // Log low stock alert
      await createAuditLog(req, {
        userId,
        action: 'yarn_low_stock',
        entityType: 'yarn',
        entityId: yarnId,
        newValues: { yards_remaining: updatedYarn.yards_remaining },
      });
    }
  });

  await createAuditLog(req, {
    userId,
    action: 'yarn_added_to_project',
    entityType: 'project',
    entityId: projectId,
    newValues: { yarnId, yardsUsed, skeinsUsed },
  });

  res.status(201).json({
    success: true,
    message: 'Yarn added to project successfully',
  });
}

/**
 * Update yarn usage in project with automatic stash adjustment
 */
export async function updateProjectYarn(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id: projectId, yarnId } = req.params;
  const { yardsUsed, skeinsUsed } = req.body;

  // Verify project exists and belongs to user
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  // Get current project yarn relationship
  const projectYarn = await db('project_yarn')
    .where({ project_id: projectId, yarn_id: yarnId })
    .first();

  if (!projectYarn) {
    throw new NotFoundError('Yarn not found in this project');
  }

  // Get yarn details
  const yarn = await db('yarn')
    .where({ id: yarnId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!yarn) {
    throw new NotFoundError('Yarn not found');
  }

  // Calculate the difference
  const yardsDiff = (yardsUsed || 0) - (projectYarn.yards_used || 0);
  const skeinsDiff = (skeinsUsed || 0) - (projectYarn.skeins_used || 0);

  // Check if sufficient yarn available for increase
  if (yardsDiff > 0 && yarn.yards_remaining < yardsDiff) {
    throw new ValidationError(`Insufficient yarn. Only ${yarn.yards_remaining} yards remaining.`);
  }
  if (skeinsDiff > 0 && yarn.skeins_remaining < skeinsDiff) {
    throw new ValidationError(`Insufficient yarn. Only ${yarn.skeins_remaining} skeins remaining.`);
  }

  // Begin transaction
  await db.transaction(async (trx) => {
    // Update project yarn usage
    await trx('project_yarn')
      .where({ project_id: projectId, yarn_id: yarnId })
      .update({
        yards_used: yardsUsed,
        skeins_used: skeinsUsed,
      });

    // Adjust stash (subtract the difference — both legacy yards and normalized meters)
    const metersDiff = Math.round(yardsDiff * 0.9144 * 100) / 100;
    await trx('yarn')
      .where({ id: yarnId })
      .update({
        yards_remaining: trx.raw('yards_remaining - ?', [yardsDiff]),
        remaining_length_m: trx.raw('GREATEST(0, COALESCE(remaining_length_m, 0) - ?)', [metersDiff]),
        skeins_remaining: trx.raw('skeins_remaining - ?', [skeinsDiff]),
        updated_at: new Date(),
      });

    // Check if yarn is now low on stock
    const updatedYarn = await trx('yarn')
      .where({ id: yarnId })
      .first();

    if (updatedYarn.low_stock_alert && updatedYarn.yards_remaining <= (updatedYarn.low_stock_threshold || 100)) {
      await createAuditLog(req, {
        userId,
        action: 'yarn_low_stock',
        entityType: 'yarn',
        entityId: yarnId,
        newValues: { yards_remaining: updatedYarn.yards_remaining },
      });
    }
  });

  await createAuditLog(req, {
    userId,
    action: 'project_yarn_updated',
    entityType: 'project',
    entityId: projectId,
    oldValues: { yardsUsed: projectYarn.yards_used, skeinsUsed: projectYarn.skeins_used },
    newValues: { yardsUsed, skeinsUsed },
  });

  res.json({
    success: true,
    message: 'Yarn usage updated successfully',
  });
}

/**
 * Remove yarn from project with stash restoration
 */
export async function removeYarnFromProject(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id: projectId, yarnId } = req.params;

  // Verify project exists and belongs to user
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  // Get current project yarn relationship
  const projectYarn = await db('project_yarn')
    .where({ project_id: projectId, yarn_id: yarnId })
    .first();

  if (!projectYarn) {
    throw new NotFoundError('Yarn not found in this project');
  }

  // Begin transaction
  await db.transaction(async (trx) => {
    // Remove yarn from project
    await trx('project_yarn')
      .where({ project_id: projectId, yarn_id: yarnId })
      .delete();

    // Restore to stash (both legacy yards and normalized meters)
    const metersReturned = Math.round((projectYarn.yards_used || 0) * 0.9144 * 100) / 100;
    await trx('yarn')
      .where({ id: yarnId })
      .update({
        yards_remaining: trx.raw('yards_remaining + ?', [projectYarn.yards_used || 0]),
        remaining_length_m: trx.raw('COALESCE(remaining_length_m, 0) + ?', [metersReturned]),
        skeins_remaining: trx.raw('skeins_remaining + ?', [projectYarn.skeins_used || 0]),
        updated_at: new Date(),
      });
  });

  await createAuditLog(req, {
    userId,
    action: 'yarn_removed_from_project',
    entityType: 'project',
    entityId: projectId,
    oldValues: { yarnId, yardsUsed: projectYarn.yards_used, skeinsUsed: projectYarn.skeins_used },
  });

  res.json({
    success: true,
    message: 'Yarn removed from project successfully',
  });
}

/**
 * Attach a pattern to a project. Accepts either a legacy `patternId` (the
 * historical path) or a canonical `patternModelId`. When a canonical id is
 * supplied, a thin legacy `patterns` stub is materialized on demand so the
 * `project_patterns.pattern_id` FK is always satisfied; the legacy stub is
 * back-linked to the canonical row via `pattern_models.source_pattern_id`,
 * so subsequent reads (PatternDetail twin lookup, project.patterns
 * enrichment) treat the canonical-only pattern like any other twin pair.
 *
 * Exactly one of `patternId` / `patternModelId` must be set in the request
 * body. Both branches dedupe on `project_patterns.(project_id, pattern_id)`.
 */
export async function addPatternToProject(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id: projectId } = req.params;
  const { patternId, patternModelId, modifications } = req.body ?? {};

  if (!patternId && !patternModelId) {
    throw new ValidationError('Either patternId or patternModelId is required');
  }
  if (patternId && patternModelId) {
    throw new ValidationError(
      'Provide only one of patternId or patternModelId, not both',
    );
  }

  // Verify project exists and belongs to user
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  // Resolve canonical → legacy stub when needed. The materializer throws
  // NotFoundError if the canonical id doesn't belong to this user, so we
  // don't need to re-verify ownership here.
  const resolvedPatternId: string = patternModelId
    ? await materializeLegacyStubForCanonical(userId, patternModelId)
    : patternId;

  // Verify pattern exists and belongs to user (catches stale legacy ids).
  const pattern = await db('patterns')
    .where({ id: resolvedPatternId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!pattern) {
    throw new NotFoundError('Pattern not found');
  }

  // Check if pattern is already added
  const existing = await db('project_patterns')
    .where({ project_id: projectId, pattern_id: resolvedPatternId })
    .first();

  if (existing) {
    throw new ValidationError('This pattern is already added to the project');
  }

  await db('project_patterns').insert({
    project_id: projectId,
    pattern_id: resolvedPatternId,
    modifications: modifications || null,
  });

  await createAuditLog(req, {
    userId,
    action: 'pattern_added_to_project',
    entityType: 'project',
    entityId: projectId,
    newValues: {
      patternId: resolvedPatternId,
      patternModelId: patternModelId ?? null,
      modifications,
    },
  });

  res.status(201).json({
    success: true,
    message: 'Pattern added to project successfully',
    data: { patternId: resolvedPatternId },
  });
}

/**
 * Remove pattern from project
 */
export async function removePatternFromProject(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id: projectId, patternId } = req.params;

  // Verify project exists and belongs to user
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  const deleted = await db('project_patterns')
    .where({ project_id: projectId, pattern_id: patternId })
    .delete();

  if (!deleted) {
    throw new NotFoundError('Pattern not found in this project');
  }

  await createAuditLog(req, {
    userId,
    action: 'pattern_removed_from_project',
    entityType: 'project',
    entityId: projectId,
    oldValues: { patternId },
  });

  res.json({
    success: true,
    message: 'Pattern removed from project successfully',
  });
}

/**
 * Add tool to project
 */
export async function addToolToProject(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id: projectId } = req.params;
  const { toolId } = req.body;

  // Verify project exists and belongs to user
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  // Verify tool exists and belongs to user
  const tool = await db('tools')
    .where({ id: toolId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!tool) {
    throw new NotFoundError('Tool not found');
  }

  // Check if tool is already added
  const existing = await db('project_tools')
    .where({ project_id: projectId, tool_id: toolId })
    .first();

  if (existing) {
    throw new ValidationError('This tool is already added to the project');
  }

  await db('project_tools').insert({
    project_id: projectId,
    tool_id: toolId,
  });

  await createAuditLog(req, {
    userId,
    action: 'tool_added_to_project',
    entityType: 'project',
    entityId: projectId,
    newValues: { toolId },
  });

  res.status(201).json({
    success: true,
    message: 'Tool added to project successfully',
  });
}

/**
 * Remove tool from project
 */
export async function removeToolFromProject(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id: projectId, toolId } = req.params;

  // Verify project exists and belongs to user
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  const deleted = await db('project_tools')
    .where({ project_id: projectId, tool_id: toolId })
    .delete();

  if (!deleted) {
    throw new NotFoundError('Tool not found in this project');
  }

  await createAuditLog(req, {
    userId,
    action: 'tool_removed_from_project',
    entityType: 'project',
    entityId: projectId,
    oldValues: { toolId },
  });

  res.json({
    success: true,
    message: 'Tool removed from project successfully',
  });
}

/**
 * Duplicate a project ("make this again"). The new project starts at row 1
 * with no yarn/photos/notes/sessions; structure (counters, panels, pattern
 * + tool links, designer metadata) carries over.
 */
export async function duplicateProject(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id } = req.params;
  const { newName } = req.body ?? {};

  if (newName !== undefined && newName !== null) {
    if (typeof newName !== 'string' || !newName.trim()) {
      throw new ValidationError('newName must be a non-empty string');
    }
  }

  const result = await duplicateProjectService(userId, id, {
    newName: typeof newName === 'string' && newName.trim() ? newName.trim() : undefined,
  });

  await createAuditLog(req, {
    userId,
    action: 'project_duplicated',
    entityType: 'project',
    entityId: result.id,
    newValues: { sourceProjectId: id, newProjectId: result.id, newName: result.name },
  });

  res.status(201).json({
    success: true,
    message: 'Project duplicated successfully',
    data: { project: result },
  });
}
