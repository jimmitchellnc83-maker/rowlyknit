import { Request, Response } from 'express';
import db from '../config/database';
import { NotFoundError, ValidationError } from '../utils/errorHandler';
import { createAuditLog } from '../middleware/auditLog';
import { computeLiveState, type PanelInput, type PanelRowInput } from '../utils/panelMath';

/**
 * Panel Groups — bind N panels to a single master counter so the client
 * can derive every panel's current row from one counter advance.
 */

async function verifyProjectOwnership(projectId: string, userId: string) {
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();
  if (!project) {
    throw new NotFoundError('Project not found');
  }
  return project;
}

export async function getPanelGroups(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id: projectId } = req.params;

  await verifyProjectOwnership(projectId, userId);

  const groups = await db('panel_groups')
    .where({ project_id: projectId })
    .orderBy('sort_order', 'asc')
    .orderBy('created_at', 'asc');

  res.json({ success: true, data: { panelGroups: groups } });
}

/**
 * Aggregate "pieces dashboard" — one request returns every group + its
 * current master row + panel count + current-row-per-panel. Used by the
 * PanelHub to render all pieces of a multi-piece garment at a glance.
 */
export async function getAllPanelGroupsLive(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id: projectId } = req.params;

  await verifyProjectOwnership(projectId, userId);

  const groups = await db('panel_groups')
    .where({ project_id: projectId })
    .orderBy('sort_order', 'asc')
    .orderBy('created_at', 'asc');

  if (groups.length === 0) {
    res.json({ success: true, data: { groups: [] } });
    return;
  }

  const masterIds = groups.map((g: any) => g.master_counter_id);
  const masters = await db('counters').whereIn('id', masterIds);
  const mastersById = new Map(masters.map((m: any) => [m.id, m]));

  const allPanels = await db('panels')
    .whereIn(
      'panel_group_id',
      groups.map((g: any) => g.id),
    )
    .orderBy('sort_order', 'asc');
  const panelsByGroupId = new Map<string, any[]>();
  for (const p of allPanels) {
    const arr = panelsByGroupId.get(p.panel_group_id) || [];
    arr.push(p);
    panelsByGroupId.set(p.panel_group_id, arr);
  }

  const summaries = groups.map((group: any) => {
    const master = mastersById.get(group.master_counter_id);
    const panels = panelsByGroupId.get(group.id) || [];
    const masterRow = master?.current_value ?? 1;
    return {
      id: group.id,
      name: group.name,
      masterCounterId: group.master_counter_id,
      masterRow,
      panelCount: panels.length,
      panelSummaries: panels.map((p: any) => {
        const effective = masterRow - 1 - p.row_offset;
        if (effective < 0) {
          return {
            id: p.id,
            name: p.name,
            display_color: p.display_color,
            started: false,
          };
        }
        return {
          id: p.id,
          name: p.name,
          display_color: p.display_color,
          started: true,
          current_row: (effective % p.repeat_length) + 1,
          repeat_length: p.repeat_length,
        };
      }),
    };
  });

  res.json({ success: true, data: { groups: summaries } });
}

/**
 * Clone every panel + every panel_row from `sourceGroupId` into the panel
 * group at `groupId`. Use case: a sweater where the right sleeve is a
 * copy of the left sleeve's panels.
 */
export async function copyPanelsFromGroup(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id: projectId, groupId } = req.params;
  const { sourceGroupId } = req.body;

  if (!sourceGroupId) {
    throw new ValidationError('sourceGroupId is required');
  }
  if (sourceGroupId === groupId) {
    throw new ValidationError('sourceGroupId must differ from target groupId');
  }

  await verifyProjectOwnership(projectId, userId);

  const [target, source] = await Promise.all([
    db('panel_groups').where({ id: groupId, project_id: projectId }).first(),
    db('panel_groups')
      .where({ id: sourceGroupId, project_id: projectId })
      .first(),
  ]);
  if (!target) throw new NotFoundError('Target panel group not found');
  if (!source) throw new NotFoundError('Source panel group not found');

  const sourcePanels = await db('panels')
    .where({ panel_group_id: sourceGroupId })
    .orderBy('sort_order', 'asc');
  if (sourcePanels.length === 0) {
    throw new ValidationError('Source panel group has no panels to copy');
  }

  const sourcePanelIds = sourcePanels.map((p: any) => p.id);
  const sourceRows = await db('panel_rows').whereIn('panel_id', sourcePanelIds);
  const rowsByPanel = new Map<string, any[]>();
  for (const r of sourceRows) {
    const arr = rowsByPanel.get(r.panel_id) || [];
    arr.push(r);
    rowsByPanel.set(r.panel_id, arr);
  }

  // Find the next sort_order on the target so copies don't collide with
  // panels the user already created on the target.
  const targetSort = await db('panels')
    .where({ panel_group_id: groupId })
    .max('sort_order as maxOrder')
    .first();
  let nextSort = (targetSort?.maxOrder ?? -1) + 1;

  const copied: string[] = [];
  await db.transaction(async (trx) => {
    for (const panel of sourcePanels) {
      const [newPanel] = await trx('panels')
        .insert({
          panel_group_id: groupId,
          name: panel.name,
          repeat_length: panel.repeat_length,
          row_offset: panel.row_offset,
          sort_order: nextSort++,
          display_color: panel.display_color,
          is_collapsed: panel.is_collapsed,
          notes: panel.notes,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*');
      copied.push(newPanel.id);

      const rows = rowsByPanel.get(panel.id) || [];
      if (rows.length > 0) {
        await trx('panel_rows').insert(
          rows.map((r: any) => ({
            panel_id: newPanel.id,
            row_number: r.row_number,
            instruction: r.instruction,
            stitch_count: r.stitch_count,
            metadata: typeof r.metadata === 'string' ? r.metadata : JSON.stringify(r.metadata ?? {}),
            created_at: new Date(),
            updated_at: new Date(),
          })),
        );
      }
    }
  });

  await createAuditLog(req, {
    userId,
    action: 'panel_group_copied_panels',
    entityType: 'panel_group',
    entityId: groupId,
    newValues: { sourceGroupId, copiedPanelIds: copied },
  });

  res.json({
    success: true,
    data: { copiedPanelCount: copied.length },
  });
}

export async function getPanelGroup(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id: projectId, groupId } = req.params;

  await verifyProjectOwnership(projectId, userId);

  const group = await db('panel_groups')
    .where({ id: groupId, project_id: projectId })
    .first();
  if (!group) {
    throw new NotFoundError('Panel group not found');
  }

  const panels = await db('panels')
    .where({ panel_group_id: groupId })
    .orderBy('sort_order', 'asc');

  const panelIds = panels.map((p: any) => p.id);
  const panelRows = panelIds.length
    ? await db('panel_rows')
        .whereIn('panel_id', panelIds)
        .orderBy('row_number', 'asc')
    : [];

  res.json({
    success: true,
    data: { panelGroup: group, panels, panelRows },
  });
}

export async function createPanelGroup(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id: projectId } = req.params;
  const {
    name,
    masterCounterId,
    createMasterCounter = false,
    sortOrder,
    displaySettings,
  } = req.body;

  if (!name) {
    throw new ValidationError('Panel group name is required');
  }
  if (!createMasterCounter && !masterCounterId) {
    throw new ValidationError(
      'Either masterCounterId or createMasterCounter must be provided',
    );
  }

  await verifyProjectOwnership(projectId, userId);

  let resolvedMasterCounterId: string = masterCounterId;

  if (createMasterCounter) {
    const sortResult = await db('counters')
      .where({ project_id: projectId })
      .max('sort_order as maxOrder')
      .first();
    const counterSortOrder = (sortResult?.maxOrder ?? -1) + 1;

    const [newCounter] = await db('counters')
      .insert({
        project_id: projectId,
        name: `${name} — Master Row`,
        type: 'rows',
        current_value: 1,
        increment_by: 1,
        sort_order: counterSortOrder,
        is_visible: true,
        auto_reset: false,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    await db('counter_history').insert({
      counter_id: newCounter.id,
      old_value: 0,
      new_value: 1,
      action: 'created',
      user_note: 'Master counter for panel group',
      created_at: new Date(),
    });

    resolvedMasterCounterId = newCounter.id;
  } else {
    const counter = await db('counters')
      .where({ id: masterCounterId, project_id: projectId })
      .first();
    if (!counter) {
      throw new ValidationError(
        'masterCounterId does not belong to this project',
      );
    }
  }

  let finalSortOrder = sortOrder;
  if (finalSortOrder === undefined) {
    const result = await db('panel_groups')
      .where({ project_id: projectId })
      .max('sort_order as maxOrder')
      .first();
    finalSortOrder = (result?.maxOrder ?? -1) + 1;
  }

  const [group] = await db('panel_groups')
    .insert({
      project_id: projectId,
      name,
      master_counter_id: resolvedMasterCounterId,
      sort_order: finalSortOrder,
      display_settings: displaySettings
        ? JSON.stringify(displaySettings)
        : JSON.stringify({}),
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning('*');

  await createAuditLog(req, {
    userId,
    action: 'panel_group_created',
    entityType: 'panel_group',
    entityId: group.id,
    newValues: group,
  });

  res.status(201).json({ success: true, data: { panelGroup: group } });
}

export async function updatePanelGroup(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id: projectId, groupId } = req.params;
  const { name, sortOrder, displaySettings } = req.body;

  await verifyProjectOwnership(projectId, userId);

  const existing = await db('panel_groups')
    .where({ id: groupId, project_id: projectId })
    .first();
  if (!existing) {
    throw new NotFoundError('Panel group not found');
  }

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (name !== undefined) updates.name = name;
  if (sortOrder !== undefined) updates.sort_order = sortOrder;
  if (displaySettings !== undefined) {
    updates.display_settings = JSON.stringify(displaySettings);
  }

  const [updated] = await db('panel_groups')
    .where({ id: groupId })
    .update(updates)
    .returning('*');

  await createAuditLog(req, {
    userId,
    action: 'panel_group_updated',
    entityType: 'panel_group',
    entityId: groupId,
    oldValues: existing,
    newValues: updated,
  });

  res.json({ success: true, data: { panelGroup: updated } });
}

export async function deletePanelGroup(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id: projectId, groupId } = req.params;

  await verifyProjectOwnership(projectId, userId);

  const existing = await db('panel_groups')
    .where({ id: groupId, project_id: projectId })
    .first();
  if (!existing) {
    throw new NotFoundError('Panel group not found');
  }

  await db('panel_groups').where({ id: groupId }).del();

  await createAuditLog(req, {
    userId,
    action: 'panel_group_deleted',
    entityType: 'panel_group',
    entityId: groupId,
    oldValues: existing,
  });

  res.json({ success: true, message: 'Panel group deleted' });
}

/**
 * The money endpoint: returns master counter + all derived panel positions
 * + LCM alignment stats in one response. KC cannot produce this.
 */
export async function getPanelGroupLive(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id: projectId, groupId } = req.params;

  await verifyProjectOwnership(projectId, userId);

  const group = await db('panel_groups')
    .where({ id: groupId, project_id: projectId })
    .first();
  if (!group) {
    throw new NotFoundError('Panel group not found');
  }

  const master = await db('counters')
    .where({ id: group.master_counter_id })
    .first();
  if (!master) {
    throw new NotFoundError('Master counter not found');
  }

  const panelRows = await db('panels')
    .where({ panel_group_id: groupId })
    .orderBy('sort_order', 'asc');

  const panels: PanelInput[] = panelRows.map((p: any) => ({
    id: p.id,
    name: p.name,
    repeat_length: p.repeat_length,
    row_offset: p.row_offset,
    display_color: p.display_color,
    sort_order: p.sort_order,
  }));

  const panelIds = panels.map((p) => p.id);
  const rows: PanelRowInput[] = panelIds.length
    ? (
        await db('panel_rows')
          .whereIn('panel_id', panelIds)
          .select('panel_id', 'row_number', 'instruction')
      ).map((r: any) => ({
        panel_id: r.panel_id,
        row_number: r.row_number,
        instruction: r.instruction,
      }))
    : [];

  const live = computeLiveState(master.id, master.current_value, panels, rows);

  res.json({
    success: true,
    data: {
      panelGroup: {
        id: group.id,
        name: group.name,
      },
      ...live,
    },
  });
}
