import { Request, Response } from 'express';
import db from '../config/database';
import { NotFoundError, ValidationError } from '../utils/errorHandler';
import { createAuditLog } from '../middleware/auditLog';

/**
 * Check if a marker is relevant for a specific row
 */
function isMarkerRelevantForRow(marker: any, row: number): boolean {
  // Check row range
  if (marker.start_row !== null && marker.end_row !== null) {
    if (row < marker.start_row || row > marker.end_row) {
      return false;
    }
  } else if (marker.start_row !== null && row < marker.start_row) {
    return false;
  } else if (marker.end_row !== null && row > marker.end_row) {
    return false;
  }

  // Check repeating interval
  if (marker.is_repeating && marker.repeat_interval) {
    const offset = marker.repeat_offset || 0;
    if ((row - offset) % marker.repeat_interval !== 0) {
      return false;
    }
    if (marker.start_row !== null && row < marker.start_row) {
      return false;
    }
  }

  // Check trigger condition
  const condition = marker.trigger_condition;
  if (condition && Object.keys(condition).length > 0) {
    switch (marker.trigger_type) {
      case 'counter_value':
        if (condition.operator === 'equals' && row !== condition.value) return false;
        if (condition.operator === 'greater_than' && row <= condition.value) return false;
        if (condition.operator === 'less_than' && row >= condition.value) return false;
        if (condition.operator === 'multiple_of' && row % condition.value !== 0) return false;
        break;

      case 'row_interval':
        if (condition.interval && row % condition.interval !== 0) return false;
        break;
    }
  }

  return true;
}

/**
 * Get all magic markers for a project
 */
export async function getMagicMarkers(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId } = req.params;
  const { counterId, isActive, category, priority, currentRow } = req.query;

  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  let query = db('magic_markers').where({ project_id: projectId });

  if (counterId) query = query.where({ counter_id: counterId });
  if (isActive !== undefined) query = query.where({ is_active: isActive === 'true' });
  if (category) query = query.where({ category });
  if (priority) query = query.where({ priority });

  const magicMarkers = await query.orderBy([
    { column: 'priority', order: 'desc' },
    { column: 'created_at', order: 'desc' }
  ]);

  const parsedMarkers = magicMarkers.map(marker => {
    const parsed = {
      ...marker,
      trigger_condition: typeof marker.trigger_condition === 'string'
        ? JSON.parse(marker.trigger_condition)
        : marker.trigger_condition,
    };
    if (currentRow) {
      parsed.isRelevantNow = isMarkerRelevantForRow(parsed, parseInt(currentRow as string, 10));
    }
    return parsed;
  });

  res.json({ success: true, data: { magicMarkers: parsedMarkers } });
}

/**
 * Get magic markers that are active for a specific row
 */
export async function getActiveMarkersForRow(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId } = req.params;
  const { row, counterId } = req.query;

  if (!row) throw new ValidationError('Row number is required');

  const rowNum = parseInt(row as string, 10);

  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) throw new NotFoundError('Project not found');

  let query = db('magic_markers')
    .where({ project_id: projectId, is_active: true })
    .where('is_completed', false)
    .where(function() {
      this.whereNull('snoozed_until').orWhere('snoozed_until', '<', new Date());
    });

  if (counterId) query = query.where({ counter_id: counterId });

  const allMarkers = await query;

  const relevantMarkers = allMarkers.filter(marker => {
    const parsed = {
      ...marker,
      trigger_condition: typeof marker.trigger_condition === 'string'
        ? JSON.parse(marker.trigger_condition)
        : marker.trigger_condition,
    };
    return isMarkerRelevantForRow(parsed, rowNum);
  });

  const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 };
  relevantMarkers.sort((a, b) =>
    (priorityOrder[b.priority as keyof typeof priorityOrder] || 2) -
    (priorityOrder[a.priority as keyof typeof priorityOrder] || 2)
  );

  res.json({
    success: true,
    data: {
      row: rowNum,
      markers: relevantMarkers.map(m => ({
        ...m,
        trigger_condition: typeof m.trigger_condition === 'string'
          ? JSON.parse(m.trigger_condition)
          : m.trigger_condition,
      })),
    },
  });
}

/**
 * Get single magic marker by ID
 */
export async function getMagicMarker(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId, markerId } = req.params;

  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) throw new NotFoundError('Project not found');

  const magicMarker = await db('magic_markers')
    .where({ id: markerId, project_id: projectId })
    .first();

  if (!magicMarker) throw new NotFoundError('Magic marker not found');

  res.json({
    success: true,
    data: {
      magicMarker: {
        ...magicMarker,
        trigger_condition: typeof magicMarker.trigger_condition === 'string'
          ? JSON.parse(magicMarker.trigger_condition)
          : magicMarker.trigger_condition,
      }
    },
  });
}

/**
 * Create a magic marker
 */
export async function createMagicMarker(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId } = req.params;
  const {
    counterId, name, triggerType, triggerCondition, alertMessage, alertType, isActive = true,
    startRow, endRow, repeatInterval, repeatOffset, isRepeating, priority, displayStyle, color, category,
  } = req.body;

  if (!name || !alertMessage) {
    throw new ValidationError('Name and alert message are required');
  }

  const validTriggerTypes = ['counter_value', 'row_interval', 'row_range', 'stitch_count', 'time_based', 'custom', 'at_same_time'];
  if (triggerType && !validTriggerTypes.includes(triggerType)) {
    throw new ValidationError(`Trigger type must be one of: ${validTriggerTypes.join(', ')}`);
  }

  const validAlertTypes = ['notification', 'sound', 'vibration', 'visual'];
  if (alertType && !validAlertTypes.includes(alertType)) {
    throw new ValidationError(`Alert type must be one of: ${validAlertTypes.join(', ')}`);
  }

  const validPriorities = ['low', 'normal', 'high', 'critical'];
  if (priority && !validPriorities.includes(priority)) {
    throw new ValidationError(`Priority must be one of: ${validPriorities.join(', ')}`);
  }

  const validDisplayStyles = ['banner', 'popup', 'toast', 'inline'];
  if (displayStyle && !validDisplayStyles.includes(displayStyle)) {
    throw new ValidationError(`Display style must be one of: ${validDisplayStyles.join(', ')}`);
  }

  const validCategories = ['reminder', 'at_same_time', 'milestone', 'shaping', 'note'];
  if (category && !validCategories.includes(category)) {
    throw new ValidationError(`Category must be one of: ${validCategories.join(', ')}`);
  }

  if (startRow !== undefined && endRow !== undefined && startRow > endRow) {
    throw new ValidationError('Start row must be less than or equal to end row');
  }

  if (isRepeating && (!repeatInterval || repeatInterval <= 0)) {
    throw new ValidationError('Repeat interval must be a positive number when repeating is enabled');
  }

  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) throw new NotFoundError('Project not found');

  if (counterId) {
    const counter = await db('counters')
      .where({ id: counterId, project_id: projectId })
      .first();
    if (!counter) throw new NotFoundError('Counter not found');
  }

  const [magicMarker] = await db('magic_markers')
    .insert({
      project_id: projectId,
      counter_id: counterId || null,
      name,
      trigger_type: triggerType || 'row_range',
      trigger_condition: triggerCondition ? JSON.stringify(triggerCondition) : JSON.stringify({}),
      alert_message: alertMessage,
      alert_type: alertType || 'notification',
      is_active: isActive,
      start_row: startRow ?? null,
      end_row: endRow ?? null,
      repeat_interval: repeatInterval ?? null,
      repeat_offset: repeatOffset ?? 0,
      is_repeating: isRepeating ?? false,
      priority: priority || 'normal',
      display_style: displayStyle || 'banner',
      color: color || null,
      category: category || 'reminder',
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning('*');

  await createAuditLog(req, {
    userId,
    action: 'magic_marker_created',
    entityType: 'magic_marker',
    entityId: magicMarker.id,
    newValues: magicMarker,
  });

  res.status(201).json({
    success: true,
    message: 'Magic marker created successfully',
    data: {
      magicMarker: {
        ...magicMarker,
        trigger_condition: typeof magicMarker.trigger_condition === 'string'
          ? JSON.parse(magicMarker.trigger_condition)
          : magicMarker.trigger_condition,
      }
    },
  });
}

/**
 * Update a magic marker
 */
export async function updateMagicMarker(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId, markerId } = req.params;
  const updates = req.body;

  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) throw new NotFoundError('Project not found');

  const magicMarker = await db('magic_markers')
    .where({ id: markerId, project_id: projectId })
    .first();

  if (!magicMarker) throw new NotFoundError('Magic marker not found');

  const updateData: any = { updated_at: new Date() };

  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.triggerType !== undefined) updateData.trigger_type = updates.triggerType;
  if (updates.triggerCondition !== undefined) {
    updateData.trigger_condition = JSON.stringify(updates.triggerCondition);
  }
  if (updates.alertMessage !== undefined) updateData.alert_message = updates.alertMessage;
  if (updates.alertType !== undefined) updateData.alert_type = updates.alertType;
  if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
  if (updates.startRow !== undefined) updateData.start_row = updates.startRow;
  if (updates.endRow !== undefined) updateData.end_row = updates.endRow;
  if (updates.repeatInterval !== undefined) updateData.repeat_interval = updates.repeatInterval;
  if (updates.repeatOffset !== undefined) updateData.repeat_offset = updates.repeatOffset;
  if (updates.isRepeating !== undefined) updateData.is_repeating = updates.isRepeating;
  if (updates.priority !== undefined) updateData.priority = updates.priority;
  if (updates.displayStyle !== undefined) updateData.display_style = updates.displayStyle;
  if (updates.color !== undefined) updateData.color = updates.color;
  if (updates.category !== undefined) updateData.category = updates.category;

  const [updatedMagicMarker] = await db('magic_markers')
    .where({ id: markerId })
    .update(updateData)
    .returning('*');

  await createAuditLog(req, {
    userId,
    action: 'magic_marker_updated',
    entityType: 'magic_marker',
    entityId: markerId,
    oldValues: magicMarker,
    newValues: updatedMagicMarker,
  });

  res.json({
    success: true,
    message: 'Magic marker updated successfully',
    data: {
      magicMarker: {
        ...updatedMagicMarker,
        trigger_condition: typeof updatedMagicMarker.trigger_condition === 'string'
          ? JSON.parse(updatedMagicMarker.trigger_condition)
          : updatedMagicMarker.trigger_condition,
      }
    },
  });
}

/**
 * Snooze a magic marker
 */
export async function snoozeMagicMarker(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId, markerId } = req.params;
  const { duration } = req.body;

  if (!duration || duration <= 0) {
    throw new ValidationError('Snooze duration must be a positive number of minutes');
  }

  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) throw new NotFoundError('Project not found');

  const magicMarker = await db('magic_markers')
    .where({ id: markerId, project_id: projectId })
    .first();

  if (!magicMarker) throw new NotFoundError('Magic marker not found');

  const snoozedUntil = new Date(Date.now() + duration * 60 * 1000);

  const [updatedMagicMarker] = await db('magic_markers')
    .where({ id: markerId })
    .update({
      snoozed_until: snoozedUntil,
      snooze_count: (magicMarker.snooze_count || 0) + 1,
      updated_at: new Date(),
    })
    .returning('*');

  res.json({
    success: true,
    message: `Magic marker snoozed for ${duration} minutes`,
    data: {
      magicMarker: {
        ...updatedMagicMarker,
        trigger_condition: typeof updatedMagicMarker.trigger_condition === 'string'
          ? JSON.parse(updatedMagicMarker.trigger_condition)
          : updatedMagicMarker.trigger_condition,
      }
    },
  });
}

/**
 * Mark a magic marker as completed
 */
export async function completeMagicMarker(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId, markerId } = req.params;

  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) throw new NotFoundError('Project not found');

  const magicMarker = await db('magic_markers')
    .where({ id: markerId, project_id: projectId })
    .first();

  if (!magicMarker) throw new NotFoundError('Magic marker not found');

  const [updatedMagicMarker] = await db('magic_markers')
    .where({ id: markerId })
    .update({
      is_completed: true,
      completed_at: new Date(),
      updated_at: new Date(),
    })
    .returning('*');

  await createAuditLog(req, {
    userId,
    action: 'magic_marker_completed',
    entityType: 'magic_marker',
    entityId: markerId,
    oldValues: magicMarker,
    newValues: updatedMagicMarker,
  });

  res.json({
    success: true,
    message: 'Magic marker marked as completed',
    data: {
      magicMarker: {
        ...updatedMagicMarker,
        trigger_condition: typeof updatedMagicMarker.trigger_condition === 'string'
          ? JSON.parse(updatedMagicMarker.trigger_condition)
          : updatedMagicMarker.trigger_condition,
      }
    },
  });
}

/**
 * Delete a magic marker
 */
export async function deleteMagicMarker(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId, markerId } = req.params;

  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) throw new NotFoundError('Project not found');

  const magicMarker = await db('magic_markers')
    .where({ id: markerId, project_id: projectId })
    .first();

  if (!magicMarker) throw new NotFoundError('Magic marker not found');

  await db('magic_markers').where({ id: markerId }).del();

  await createAuditLog(req, {
    userId,
    action: 'magic_marker_deleted',
    entityType: 'magic_marker',
    entityId: markerId,
    oldValues: magicMarker,
  });

  res.json({ success: true, message: 'Magic marker deleted successfully' });
}

/**
 * Toggle magic marker active status
 */
export async function toggleMagicMarker(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId, markerId } = req.params;

  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) throw new NotFoundError('Project not found');

  const magicMarker = await db('magic_markers')
    .where({ id: markerId, project_id: projectId })
    .first();

  if (!magicMarker) throw new NotFoundError('Magic marker not found');

  const [updatedMagicMarker] = await db('magic_markers')
    .where({ id: markerId })
    .update({
      is_active: !magicMarker.is_active,
      updated_at: new Date(),
    })
    .returning('*');

  await createAuditLog(req, {
    userId,
    action: 'magic_marker_toggled',
    entityType: 'magic_marker',
    entityId: markerId,
    oldValues: magicMarker,
    newValues: updatedMagicMarker,
  });

  res.json({
    success: true,
    message: `Magic marker ${updatedMagicMarker.is_active ? 'activated' : 'deactivated'} successfully`,
    data: {
      magicMarker: {
        ...updatedMagicMarker,
        trigger_condition: typeof updatedMagicMarker.trigger_condition === 'string'
          ? JSON.parse(updatedMagicMarker.trigger_condition)
          : updatedMagicMarker.trigger_condition,
      }
    },
  });
}

/**
 * Record that a marker was triggered
 */
export async function recordTrigger(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId, markerId } = req.params;

  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) throw new NotFoundError('Project not found');

  const magicMarker = await db('magic_markers')
    .where({ id: markerId, project_id: projectId })
    .first();

  if (!magicMarker) throw new NotFoundError('Magic marker not found');

  const [updatedMagicMarker] = await db('magic_markers')
    .where({ id: markerId })
    .update({
      last_triggered: new Date(),
      trigger_count: (magicMarker.trigger_count || 0) + 1,
      updated_at: new Date(),
    })
    .returning('*');

  res.json({
    success: true,
    data: {
      magicMarker: {
        ...updatedMagicMarker,
        trigger_condition: typeof updatedMagicMarker.trigger_condition === 'string'
          ? JSON.parse(updatedMagicMarker.trigger_condition)
          : updatedMagicMarker.trigger_condition,
      }
    },
  });
}

/**
 * Check and trigger magic markers based on counter values
 */
export async function checkMagicMarkers(projectId: string, counterId: string, counterValue: number) {
  const magicMarkers = await db('magic_markers')
    .where({
      project_id: projectId,
      counter_id: counterId,
      is_active: true,
    })
    .where(function() {
      this.where('is_completed', false).orWhereNull('is_completed');
    })
    .where(function() {
      this.whereNull('snoozed_until').orWhere('snoozed_until', '<', new Date());
    });

  const triggeredMarkers = [];

  for (const marker of magicMarkers) {
    const parsed = {
      ...marker,
      trigger_condition: typeof marker.trigger_condition === 'string'
        ? JSON.parse(marker.trigger_condition)
        : marker.trigger_condition,
    };

    if (isMarkerRelevantForRow(parsed, counterValue)) {
      triggeredMarkers.push(parsed);

      await db('magic_markers')
        .where({ id: marker.id })
        .update({
          last_triggered: new Date(),
          trigger_count: (marker.trigger_count || 0) + 1,
        });
    }
  }

  const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 };
  triggeredMarkers.sort((a, b) =>
    (priorityOrder[b.priority as keyof typeof priorityOrder] || 2) -
    (priorityOrder[a.priority as keyof typeof priorityOrder] || 2)
  );

  return triggeredMarkers;
}
