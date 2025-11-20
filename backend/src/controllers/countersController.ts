import { Request, Response } from 'express';
import db from '../config/database';
import { NotFoundError, ValidationError } from '../utils/errorHandler';
import { createAuditLog } from '../middleware/auditLog';
import { getIO } from '../config/socket';

/**
 * Get all counters for a project
 */
export async function getCounters(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId } = req.params;

  // Verify project ownership
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  const counters = await db('counters')
    .where({ project_id: projectId })
    .orderBy('sort_order', 'asc')
    .orderBy('created_at', 'asc');

  res.json({
    success: true,
    data: { counters },
  });
}

/**
 * Get single counter by ID
 */
export async function getCounter(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId, counterId } = req.params;

  // Verify project ownership
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  const counter = await db('counters')
    .where({ id: counterId, project_id: projectId })
    .first();

  if (!counter) {
    throw new NotFoundError('Counter not found');
  }

  res.json({
    success: true,
    data: { counter },
  });
}

/**
 * Create a new counter
 */
export async function createCounter(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId } = req.params;
  const {
    name,
    type,
    currentValue = 0,
    targetValue,
    incrementBy = 1,
    minValue,
    maxValue,
    displayColor,
    isVisible = true,
    incrementPattern,
    sortOrder,
    notes,
  } = req.body;

  if (!name) {
    throw new ValidationError('Counter name is required');
  }

  // Verify project ownership
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  // Get next sort order if not provided
  let finalSortOrder = sortOrder;
  if (finalSortOrder === undefined) {
    const result = await db('counters')
      .where({ project_id: projectId })
      .max('sort_order as maxOrder')
      .first();
    finalSortOrder = (result?.maxOrder ?? -1) + 1;
  }

  const [counter] = await db('counters')
    .insert({
      project_id: projectId,
      name,
      type: type || 'row',  // Fixed: Changed from 'rows' to 'row' to match database schema
      current_value: currentValue,
      target_value: targetValue,
      increment_by: incrementBy,
      min_value: minValue,
      max_value: maxValue,
      display_color: displayColor,
      is_visible: isVisible,
      increment_pattern: incrementPattern ? JSON.stringify(incrementPattern) : null,
      sort_order: finalSortOrder,
      notes: notes || null,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning('*');

  // Create initial history entry
  await db('counter_history').insert({
    counter_id: counter.id,
    old_value: 0, // For new counters, old value is 0
    new_value: currentValue,
    action: 'created',
    user_note: null,
    created_at: new Date(),
  });

  await createAuditLog(req, {
    userId,
    action: 'counter_created',
    entityType: 'counter',
    entityId: counter.id,
    newValues: counter,
  });

  res.status(201).json({
    success: true,
    message: 'Counter created successfully',
    data: { counter },
  });
}

/**
 * Update a counter (including value changes)
 */
export async function updateCounter(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId, counterId } = req.params;
  const updates = req.body;

  // Verify project ownership
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  const counter = await db('counters')
    .where({ id: counterId, project_id: projectId })
    .first();

  if (!counter) {
    throw new NotFoundError('Counter not found');
  }

  const oldValue = counter.current_value;
  const newValue = updates.current_value !== undefined ? updates.current_value : oldValue;

  // Prepare update data
  const updateData: any = {
    updated_at: new Date(),
  };

  // Update allowed fields
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.type !== undefined) updateData.type = updates.type;
  if (updates.current_value !== undefined) updateData.current_value = updates.current_value;
  if (updates.target_value !== undefined) updateData.target_value = updates.target_value;
  if (updates.increment_by !== undefined) updateData.increment_by = updates.increment_by;
  if (updates.min_value !== undefined) updateData.min_value = updates.min_value;
  if (updates.max_value !== undefined) updateData.max_value = updates.max_value;
  if (updates.display_color !== undefined) updateData.display_color = updates.display_color;
  if (updates.is_visible !== undefined) updateData.is_visible = updates.is_visible;
  if (updates.increment_pattern !== undefined) {
    updateData.increment_pattern = updates.increment_pattern ? JSON.stringify(updates.increment_pattern) : null;
  }
  if (updates.sort_order !== undefined) updateData.sort_order = updates.sort_order;
  if (updates.notes !== undefined) updateData.notes = updates.notes;

  const [updatedCounter] = await db('counters')
    .where({ id: counterId })
    .update(updateData)
    .returning('*');

  // Create history entry if value changed
  if (oldValue !== newValue) {
    await db('counter_history').insert({
      counter_id: counterId,
      old_value: oldValue,
      new_value: newValue,
      action: updates.action || 'updated',
      user_note: updates.user_note || null,
      created_at: new Date(),
    });

    // Check and execute linked counter actions
    await checkAndExecuteCounterLinks(counterId, newValue, userId, req);
  }

  await createAuditLog(req, {
    userId,
    action: 'counter_updated',
    entityType: 'counter',
    entityId: counterId,
    oldValues: counter,
    newValues: updatedCounter,
  });

  res.json({
    success: true,
    message: 'Counter updated successfully',
    data: { counter: updatedCounter },
  });
}

/**
 * Delete a counter
 */
export async function deleteCounter(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId, counterId } = req.params;

  // Verify project ownership
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  const counter = await db('counters')
    .where({ id: counterId, project_id: projectId })
    .first();

  if (!counter) {
    throw new NotFoundError('Counter not found');
  }

  // Delete counter (cascade will handle history and links)
  await db('counters').where({ id: counterId }).del();

  await createAuditLog(req, {
    userId,
    action: 'counter_deleted',
    entityType: 'counter',
    entityId: counterId,
    oldValues: counter,
  });

  res.json({
    success: true,
    message: 'Counter deleted successfully',
  });
}

/**
 * Reorder counters
 */
export async function reorderCounters(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId } = req.params;
  const { counters } = req.body;

  if (!Array.isArray(counters)) {
    throw new ValidationError('Counters must be an array');
  }

  // Verify project ownership
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  // Update sort order for each counter
  await db.transaction(async (trx) => {
    for (const item of counters) {
      await trx('counters')
        .where({ id: item.id, project_id: projectId })
        .update({
          sort_order: item.sort_order,
          updated_at: new Date(),
        });
    }
  });

  res.json({
    success: true,
    message: 'Counters reordered successfully',
  });
}

/**
 * Get counter history
 */
export async function getCounterHistory(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId, counterId } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  // Verify project ownership
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  const counter = await db('counters')
    .where({ id: counterId, project_id: projectId })
    .first();

  if (!counter) {
    throw new NotFoundError('Counter not found');
  }

  const [{ count }] = await db('counter_history')
    .where({ counter_id: counterId })
    .count('* as count');

  const history = await db('counter_history')
    .where({ counter_id: counterId })
    .orderBy('created_at', 'desc')
    .limit(Number(limit))
    .offset(Number(offset));

  res.json({
    success: true,
    data: {
      history,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: Number(count),
      },
    },
  });
}

/**
 * Undo counter to a specific history point
 */
export async function undoCounterToPoint(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId, counterId, historyId } = req.params;

  // Verify project ownership
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  const counter = await db('counters')
    .where({ id: counterId, project_id: projectId })
    .first();

  if (!counter) {
    throw new NotFoundError('Counter not found');
  }

  const historyEntry = await db('counter_history')
    .where({ id: historyId, counter_id: counterId })
    .first();

  if (!historyEntry) {
    throw new NotFoundError('History entry not found');
  }

  const oldValue = counter.current_value;
  const newValue = historyEntry.old_value;

  // Update counter to the old value from history
  const [updatedCounter] = await db('counters')
    .where({ id: counterId })
    .update({
      current_value: newValue,
      updated_at: new Date(),
    })
    .returning('*');

  // Create new history entry for the undo
  await db('counter_history').insert({
    counter_id: counterId,
    old_value: oldValue,
    new_value: newValue,
    action: 'undo',
    user_note: `Undo to history entry ${historyId}`,
    created_at: new Date(),
  });

  await createAuditLog(req, {
    userId,
    action: 'counter_undo',
    entityType: 'counter',
    entityId: counterId,
    oldValues: { current_value: oldValue },
    newValues: { current_value: newValue },
  });

  res.json({
    success: true,
    message: 'Counter reverted successfully',
    data: { counter: updatedCounter },
  });
}

/**
 * Helper function to check and execute linked counter actions
 */
async function checkAndExecuteCounterLinks(
  counterId: string,
  newValue: number,
  userId: string,
  req: Request
) {
  // Get all active links where this counter is the source
  const links = await db('counter_links')
    .where({
      source_counter_id: counterId,
      is_active: true,
    });

  console.log(`[Counter Links] Checking ${links.length} link(s) for counter ${counterId} (value: ${newValue})`);

  for (const link of links) {
    let shouldTrigger = false;

    try {
      // Parse trigger condition (stored as JSON string in database)
      let condition = link.trigger_condition;
      if (typeof condition === 'string') {
        try {
          condition = JSON.parse(condition);
        } catch (e) {
          console.error(`[Counter Links] Failed to parse trigger_condition for link ${link.id}:`, e);
          continue;
        }
      }

      if (typeof condition === 'object' && condition !== null) {
        const { type, value } = condition as any;

        console.log(`[Counter Links] Link ${link.id}: Checking condition ${type} ${value} against ${newValue}`);

        switch (type) {
          case 'equals':
            shouldTrigger = newValue === value;
            break;
          case 'greater_than':
            shouldTrigger = newValue > value;
            break;
          case 'less_than':
            shouldTrigger = newValue < value;
            break;
          case 'multiple_of':
          case 'modulo':
            shouldTrigger = value > 0 && newValue % value === 0;
            break;
          case 'every_n':
            shouldTrigger = value > 0 && newValue % value === 0 && newValue > 0;
            break;
        }

        console.log(`[Counter Links] Link ${link.id}: Trigger = ${shouldTrigger}`);
      }

      if (shouldTrigger) {
        // Get target counter
        const targetCounter = await db('counters')
          .where({ id: link.target_counter_id })
          .first();

        if (!targetCounter) {
          console.warn(`[Counter Links] Target counter ${link.target_counter_id} not found for link ${link.id}`);
          continue;
        }

        const targetOldValue = targetCounter.current_value;
        let targetNewValue = targetOldValue;

        // Parse and execute action (stored as JSON string in database)
        let action = link.action;
        if (typeof action === 'string') {
          try {
            action = JSON.parse(action);
          } catch (e) {
            console.error(`[Counter Links] Failed to parse action for link ${link.id}:`, e);
            continue;
          }
        }

        if (typeof action === 'object' && action !== null) {
          const { type, value } = action as any;

          console.log(`[Counter Links] Executing action ${type} ${value !== undefined ? value : ''} on counter ${link.target_counter_id}`);

          switch (type) {
            case 'increment':
              targetNewValue = targetOldValue + (value || 1);
              break;
            case 'decrement':
              targetNewValue = targetOldValue - (value || 1);
              break;
            case 'reset':
              targetNewValue = value !== undefined ? value : 0;
              break;
            case 'set':
              targetNewValue = value;
              break;
          }
        }

        // Apply min/max constraints
        if (targetCounter.min_value !== null && targetNewValue < targetCounter.min_value) {
          console.log(`[Counter Links] Clamping to min_value: ${targetCounter.min_value}`);
          targetNewValue = targetCounter.min_value;
        }
        if (targetCounter.max_value !== null && targetNewValue > targetCounter.max_value) {
          console.log(`[Counter Links] Clamping to max_value: ${targetCounter.max_value}`);
          targetNewValue = targetCounter.max_value;
        }

        console.log(`[Counter Links] Updating counter ${link.target_counter_id}: ${targetOldValue} → ${targetNewValue}`);

        // Update target counter
        await db('counters')
          .where({ id: link.target_counter_id })
          .update({
            current_value: targetNewValue,
            updated_at: new Date(),
          });

        // Create history entry for target counter
        await db('counter_history').insert({
          counter_id: link.target_counter_id,
          old_value: targetOldValue,
          new_value: targetNewValue,
          action: 'linked_update',
          user_note: `Auto-updated by linked counter: ${counterId}`,
          created_at: new Date(),
        });

        // Audit log
        await createAuditLog(req, {
          userId,
          action: 'counter_linked_update',
          entityType: 'counter',
          entityId: link.target_counter_id,
          oldValues: { current_value: targetOldValue },
          newValues: { current_value: targetNewValue },
        });

        // Emit WebSocket event for real-time updates
        try {
          const io = getIO();
          io.to(`project:${targetCounter.project_id}`).emit('counter:updated', {
            counterId: link.target_counter_id,
            projectId: targetCounter.project_id,
            currentValue: targetNewValue,
            linkedFrom: counterId,
          });
          console.log(`[Counter Links] WebSocket event emitted for counter ${link.target_counter_id}`);
        } catch (socketError) {
          // Don't fail the whole operation if WebSocket fails
          console.error(`[Counter Links] Failed to emit WebSocket event:`, socketError);
        }

        console.log(`[Counter Links] Successfully updated linked counter ${link.target_counter_id}`);
      }
    } catch (error) {
      console.error(`[Counter Links] Error processing link ${link.id}:`, error);
      // Continue processing other links even if one fails
    }
  }
}
