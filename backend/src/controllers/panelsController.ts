import { Request, Response } from 'express';
import db from '../config/database';
import { NotFoundError, ValidationError } from '../utils/errorHandler';
import { createAuditLog } from '../middleware/auditLog';

/**
 * Resolve panel → panel_group → project, and verify ownership.
 * Returns the joined row or throws NotFoundError.
 */
async function verifyPanelOwnership(panelId: string, userId: string) {
  const row = await db('panels as p')
    .join('panel_groups as g', 'p.panel_group_id', 'g.id')
    .join('projects as pr', 'g.project_id', 'pr.id')
    .where('p.id', panelId)
    .where('pr.user_id', userId)
    .whereNull('pr.deleted_at')
    .select(
      'p.id as panel_id',
      'p.panel_group_id',
      'g.project_id',
      'g.name as panel_group_name',
    )
    .first();
  if (!row) {
    throw new NotFoundError('Panel not found');
  }
  return row;
}

async function verifyPanelGroupOwnership(
  groupId: string,
  projectId: string,
  userId: string,
) {
  const row = await db('panel_groups as g')
    .join('projects as pr', 'g.project_id', 'pr.id')
    .where('g.id', groupId)
    .where('g.project_id', projectId)
    .where('pr.user_id', userId)
    .whereNull('pr.deleted_at')
    .select('g.id', 'g.project_id')
    .first();
  if (!row) {
    throw new NotFoundError('Panel group not found');
  }
  return row;
}

export async function createPanel(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id: projectId, groupId } = req.params;
  const {
    name,
    repeatLength,
    rowOffset = 0,
    sortOrder,
    displayColor,
    isCollapsed = false,
    notes,
    rows,
  } = req.body;

  if (!name) throw new ValidationError('Panel name is required');
  if (!repeatLength || repeatLength <= 0) {
    throw new ValidationError('repeatLength must be > 0');
  }

  await verifyPanelGroupOwnership(groupId, projectId, userId);

  let finalSortOrder = sortOrder;
  if (finalSortOrder === undefined) {
    const result = await db('panels')
      .where({ panel_group_id: groupId })
      .max('sort_order as maxOrder')
      .first();
    finalSortOrder = (result?.maxOrder ?? -1) + 1;
  }

  const [panel] = await db('panels')
    .insert({
      panel_group_id: groupId,
      name,
      repeat_length: repeatLength,
      row_offset: rowOffset,
      sort_order: finalSortOrder,
      display_color: displayColor ?? null,
      is_collapsed: isCollapsed,
      notes: notes ?? null,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning('*');

  // Optional: seed panel_rows in the same request.
  if (Array.isArray(rows) && rows.length > 0) {
    validatePanelRowsShape(rows, repeatLength);
    await db('panel_rows').insert(
      rows.map((r: { rowNumber?: number; row_number?: number; instruction: string; stitchCount?: number | null; metadata?: unknown }) => ({
        panel_id: panel.id,
        row_number: r.rowNumber ?? r.row_number,
        instruction: r.instruction,
        stitch_count: r.stitchCount ?? null,
        metadata: r.metadata ? JSON.stringify(r.metadata) : JSON.stringify({}),
        created_at: new Date(),
        updated_at: new Date(),
      })),
    );
  }

  await createAuditLog(req, {
    userId,
    action: 'panel_created',
    entityType: 'panel',
    entityId: panel.id,
    newValues: panel,
  });

  res.status(201).json({ success: true, data: { panel } });
}

export async function updatePanel(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { panelId } = req.params;
  await verifyPanelOwnership(panelId, userId);

  const {
    name,
    repeatLength,
    rowOffset,
    sortOrder,
    displayColor,
    isCollapsed,
    notes,
  } = req.body;

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (name !== undefined) updates.name = name;
  if (repeatLength !== undefined) {
    if (repeatLength <= 0) {
      throw new ValidationError('repeatLength must be > 0');
    }
    updates.repeat_length = repeatLength;
  }
  if (rowOffset !== undefined) {
    if (rowOffset < 0) throw new ValidationError('rowOffset must be >= 0');
    updates.row_offset = rowOffset;
  }
  if (sortOrder !== undefined) updates.sort_order = sortOrder;
  if (displayColor !== undefined) updates.display_color = displayColor;
  if (isCollapsed !== undefined) updates.is_collapsed = isCollapsed;
  if (notes !== undefined) updates.notes = notes;

  const [updated] = await db('panels')
    .where({ id: panelId })
    .update(updates)
    .returning('*');

  await createAuditLog(req, {
    userId,
    action: 'panel_updated',
    entityType: 'panel',
    entityId: panelId,
    newValues: updated,
  });

  res.json({ success: true, data: { panel: updated } });
}

export async function deletePanel(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { panelId } = req.params;
  const existing = await verifyPanelOwnership(panelId, userId);

  await db('panels').where({ id: panelId }).del();

  await createAuditLog(req, {
    userId,
    action: 'panel_deleted',
    entityType: 'panel',
    entityId: panelId,
    oldValues: existing,
  });

  res.json({ success: true, message: 'Panel deleted' });
}

/**
 * Replace all rows for a panel. Transactional — old rows are deleted
 * and new ones inserted in one go so the panel is never half-populated.
 */
export async function bulkReplacePanelRows(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { panelId } = req.params;
  const { rows } = req.body;

  if (!Array.isArray(rows)) {
    throw new ValidationError('rows must be an array');
  }

  const panel = await db('panels as p')
    .join('panel_groups as g', 'p.panel_group_id', 'g.id')
    .join('projects as pr', 'g.project_id', 'pr.id')
    .where('p.id', panelId)
    .where('pr.user_id', userId)
    .whereNull('pr.deleted_at')
    .select('p.id', 'p.repeat_length')
    .first();
  if (!panel) {
    throw new NotFoundError('Panel not found');
  }

  validatePanelRowsShape(rows, panel.repeat_length);

  const toInsert = rows.map(
    (r: {
      rowNumber?: number;
      row_number?: number;
      instruction: string;
      stitchCount?: number | null;
      metadata?: unknown;
    }) => ({
      panel_id: panelId,
      row_number: r.rowNumber ?? r.row_number,
      instruction: r.instruction,
      stitch_count: r.stitchCount ?? null,
      metadata: r.metadata ? JSON.stringify(r.metadata) : JSON.stringify({}),
      created_at: new Date(),
      updated_at: new Date(),
    }),
  );

  await db.transaction(async (trx) => {
    await trx('panel_rows').where({ panel_id: panelId }).del();
    if (toInsert.length > 0) {
      await trx('panel_rows').insert(toInsert);
    }
  });

  await createAuditLog(req, {
    userId,
    action: 'panel_rows_bulk_replaced',
    entityType: 'panel',
    entityId: panelId,
    newValues: { rowCount: toInsert.length },
  });

  res.json({
    success: true,
    data: { panelId, rowCount: toInsert.length },
  });
}

function validatePanelRowsShape(rows: unknown[], repeatLength: number) {
  const seen = new Set<number>();
  for (const r of rows) {
    if (typeof r !== 'object' || r === null) {
      throw new ValidationError('Each row must be an object');
    }
    const rec = r as { rowNumber?: unknown; row_number?: unknown; instruction?: unknown };
    const rowNumber = rec.rowNumber ?? rec.row_number;
    if (typeof rowNumber !== 'number' || !Number.isInteger(rowNumber) || rowNumber <= 0) {
      throw new ValidationError('Each row must have rowNumber > 0');
    }
    if (rowNumber > repeatLength) {
      throw new ValidationError(
        `rowNumber ${rowNumber} exceeds repeatLength ${repeatLength}`,
      );
    }
    if (seen.has(rowNumber)) {
      throw new ValidationError(`Duplicate rowNumber: ${rowNumber}`);
    }
    seen.add(rowNumber);
    if (typeof rec.instruction !== 'string' || rec.instruction.length === 0) {
      throw new ValidationError(
        `Row ${rowNumber}: instruction must be a non-empty string`,
      );
    }
  }
}
