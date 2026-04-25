import db from '../config/database';
import { NotFoundError } from '../utils/errorHandler';

export interface DuplicateOptions {
  newName?: string;
  carryRecipient?: boolean;
}

export interface DuplicateResult {
  id: string;
  name: string;
}

/**
 * Duplicate a project so the user can "make this again" without re-entering
 * everything. Carries: project row, pattern links, tool links, counters
 * (with current_value reset), counter hierarchy + counter_links, and
 * Guided Pieces panel groups + panels + panel_rows. Skips: yarn assignments
 * (re-deplete is wrong), photos / notes / memos / sessions / ratings
 * (history-of-the-original), magic markers (often fire-once), is_public /
 * share_slug (the new project is private until the owner publishes).
 */
export async function duplicateProject(
  userId: string,
  sourceId: string,
  options: DuplicateOptions = {},
): Promise<DuplicateResult> {
  return await db.transaction(async (trx) => {
    const source = await trx('projects')
      .where({ id: sourceId, user_id: userId })
      .whereNull('deleted_at')
      .first();
    if (!source) {
      throw new NotFoundError('Project not found');
    }

    const newName = (options.newName ?? `${source.name} (copy)`).slice(0, 255);

    const [newProject] = await trx('projects')
      .insert({
        user_id: userId,
        name: newName,
        description: source.description,
        status: 'active',
        project_type: source.project_type,
        start_date: null,
        target_completion_date: null,
        actual_completion_date: null,
        notes: source.notes,
        metadata: stringifyJson(source.metadata, '{}'),
        tags: stringifyJson(source.tags, '[]'),
        progress_percentage: 0,
        thumbnail_url: null,
        view_count: 0,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    // Counters — clone with current_value reset to min_value (or 0).
    // Self-referential parent_counter_id is resolved in a second pass after
    // every new ID exists.
    const sourceCounters = await trx('counters').where({ project_id: sourceId });
    const counterIdMap = new Map<string, string>();

    for (const c of sourceCounters) {
      const [inserted] = await trx('counters')
        .insert({
          project_id: newProject.id,
          name: c.name,
          type: c.type,
          current_value: c.min_value ?? 0,
          target_value: c.target_value,
          increment_by: c.increment_by,
          min_value: c.min_value,
          max_value: c.max_value,
          notes: c.notes,
          is_active: c.is_active,
          sort_order: c.sort_order,
          parent_counter_id: null, // resolved below
          auto_reset: c.auto_reset,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('id');
      counterIdMap.set(c.id, inserted.id);
    }

    // Resolve parent_counter_id with the mapping now that every counter
    // exists. Skip orphans (parent in another project — shouldn't happen
    // but cheaper to skip than to fail).
    for (const c of sourceCounters) {
      if (!c.parent_counter_id) continue;
      const newParent = counterIdMap.get(c.parent_counter_id);
      if (!newParent) continue;
      const newId = counterIdMap.get(c.id);
      if (!newId) continue;
      await trx('counters').where({ id: newId }).update({ parent_counter_id: newParent });
    }

    // counter_links — both ends must remap; skip any link whose ends we
    // didn't clone.
    const sourceCounterIds = sourceCounters.map((c) => c.id);
    if (sourceCounterIds.length > 0) {
      const links = await trx('counter_links')
        .whereIn('source_counter_id', sourceCounterIds)
        .orWhereIn('target_counter_id', sourceCounterIds);
      for (const link of links) {
        const newSource = counterIdMap.get(link.source_counter_id);
        const newTarget = counterIdMap.get(link.target_counter_id);
        if (!newSource || !newTarget) continue;
        await trx('counter_links').insert({
          source_counter_id: newSource,
          target_counter_id: newTarget,
          link_type: link.link_type,
          trigger_condition: link.trigger_condition === null ? null : stringifyJson(link.trigger_condition, 'null'),
          action: link.action === null ? null : stringifyJson(link.action, 'null'),
          is_active: link.is_active,
          created_at: new Date(),
        });
      }
    }

    // project_patterns junction
    const patternLinks = await trx('project_patterns').where({ project_id: sourceId });
    for (const pl of patternLinks) {
      await trx('project_patterns').insert({
        project_id: newProject.id,
        pattern_id: pl.pattern_id,
        modifications: pl.modifications,
        created_at: new Date(),
      });
    }

    // project_tools junction
    const toolLinks = await trx('project_tools').where({ project_id: sourceId });
    for (const tl of toolLinks) {
      await trx('project_tools').insert({
        project_id: newProject.id,
        tool_id: tl.tool_id,
        created_at: new Date(),
      });
    }

    // panel_groups → panels → panel_rows (Guided Pieces structure)
    const sourceGroups = await trx('panel_groups').where({ project_id: sourceId });
    for (const g of sourceGroups) {
      const newMaster = counterIdMap.get(g.master_counter_id);
      if (!newMaster) continue; // master counter wasn't on source project — skip group
      const [newGroup] = await trx('panel_groups')
        .insert({
          project_id: newProject.id,
          name: g.name,
          master_counter_id: newMaster,
          sort_order: g.sort_order,
          display_settings: stringifyJson(g.display_settings, '{}'),
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('id');

      const sourcePanels = await trx('panels').where({ panel_group_id: g.id });
      for (const p of sourcePanels) {
        const [newPanel] = await trx('panels')
          .insert({
            panel_group_id: newGroup.id,
            name: p.name,
            repeat_length: p.repeat_length,
            row_offset: p.row_offset,
            sort_order: p.sort_order,
            display_color: p.display_color,
            is_collapsed: p.is_collapsed,
            notes: p.notes,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returning('id');

        const sourceRows = await trx('panel_rows').where({ panel_id: p.id });
        if (sourceRows.length > 0) {
          await trx('panel_rows').insert(
            sourceRows.map((r) => ({
              panel_id: newPanel.id,
              row_number: r.row_number,
              instruction: r.instruction,
              stitch_count: r.stitch_count,
              metadata: stringifyJson(r.metadata, '{}'),
              created_at: new Date(),
              updated_at: new Date(),
            })),
          );
        }
      }
    }

    return { id: newProject.id, name: newProject.name };
  });
}

/**
 * Knex+pg returns jsonb columns as parsed objects, but on insert it can
 * accept either a JSON string or an object. Normalize to string so the
 * insert payload stays consistent with createProject.
 */
function stringifyJson(value: unknown, fallback: string): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}
