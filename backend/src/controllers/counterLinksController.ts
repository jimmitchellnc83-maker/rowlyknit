import { Request, Response } from 'express';
import db from '../config/database';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errorHandler';
import { createAuditLog } from '../middleware/auditLog';

/**
 * Get all links for a counter
 */
export async function getCounterLinks(req: Request, res: Response) {
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

  // Get all links where this counter is source or target
  const links = await db('counter_links')
    .where('source_counter_id', counterId)
    .orWhere('target_counter_id', counterId)
    .orderBy('created_at', 'desc');

  // Enhance with counter details
  const enhancedLinks = await Promise.all(
    links.map(async (link) => {
      const [sourceCounter, targetCounter] = await Promise.all([
        db('counters').where({ id: link.source_counter_id }).first(),
        db('counters').where({ id: link.target_counter_id }).first(),
      ]);

      return {
        ...link,
        source_counter: sourceCounter,
        target_counter: targetCounter,
      };
    })
  );

  res.json({
    success: true,
    data: { links: enhancedLinks },
  });
}

/**
 * Get all links for a project
 */
export async function getProjectLinks(req: Request, res: Response) {
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

  // Get all counters for this project
  const counters = await db('counters')
    .where({ project_id: projectId })
    .select('id');

  const counterIds = counters.map((c) => c.id);

  if (counterIds.length === 0) {
    return res.json({
      success: true,
      data: { links: [] },
    });
  }

  // Get all links for these counters
  const links = await db('counter_links')
    .whereIn('source_counter_id', counterIds)
    .orderBy('created_at', 'desc');

  // Enhance with counter details
  const enhancedLinks = await Promise.all(
    links.map(async (link) => {
      const [sourceCounter, targetCounter] = await Promise.all([
        db('counters').where({ id: link.source_counter_id }).first(),
        db('counters').where({ id: link.target_counter_id }).first(),
      ]);

      return {
        ...link,
        source_counter: sourceCounter,
        target_counter: targetCounter,
      };
    })
  );

  res.json({
    success: true,
    data: { links: enhancedLinks },
  });
}

/**
 * Create a counter link
 */
export async function createCounterLink(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId } = req.params;
  const {
    sourceCounterId,
    targetCounterId,
    linkType,
    triggerCondition,
    action,
    isActive = true,
  } = req.body;

  if (!sourceCounterId || !targetCounterId) {
    throw new ValidationError('Source and target counter IDs are required');
  }

  if (sourceCounterId === targetCounterId) {
    throw new ValidationError('Source and target counters cannot be the same');
  }

  if (!triggerCondition || !action) {
    throw new ValidationError('Trigger condition and action are required');
  }

  // Verify project ownership
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  // Verify both counters belong to this project
  const [sourceCounter, targetCounter] = await Promise.all([
    db('counters').where({ id: sourceCounterId, project_id: projectId }).first(),
    db('counters').where({ id: targetCounterId, project_id: projectId }).first(),
  ]);

  if (!sourceCounter) {
    throw new NotFoundError('Source counter not found');
  }

  if (!targetCounter) {
    throw new NotFoundError('Target counter not found');
  }

  // Create the link
  const [link] = await db('counter_links')
    .insert({
      source_counter_id: sourceCounterId,
      target_counter_id: targetCounterId,
      link_type: linkType || 'conditional',
      trigger_condition: JSON.stringify(triggerCondition),
      action: JSON.stringify(action),
      is_active: isActive,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning('*');

  await createAuditLog(req, {
    userId,
    action: 'counter_link_created',
    entityType: 'counter_link',
    entityId: link.id,
    newValues: link,
  });

  res.status(201).json({
    success: true,
    message: 'Counter link created successfully',
    data: { link },
  });
}

/**
 * Update a counter link
 */
export async function updateCounterLink(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId, linkId } = req.params;
  const updates = req.body;

  // Verify project ownership
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  // Get the link and verify it belongs to this project
  const link = await db('counter_links')
    .where({ id: linkId })
    .first();

  if (!link) {
    throw new NotFoundError('Counter link not found');
  }

  // Verify source counter belongs to project
  const sourceCounter = await db('counters')
    .where({ id: link.source_counter_id, project_id: projectId })
    .first();

  if (!sourceCounter) {
    throw new ForbiddenError('Link does not belong to this project');
  }

  // Prepare update data
  const updateData: any = {
    updated_at: new Date(),
  };

  if (updates.linkType !== undefined) updateData.link_type = updates.linkType;
  if (updates.triggerCondition !== undefined) {
    updateData.trigger_condition = JSON.stringify(updates.triggerCondition);
  }
  if (updates.action !== undefined) updateData.action = JSON.stringify(updates.action);
  if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

  const [updatedLink] = await db('counter_links')
    .where({ id: linkId })
    .update(updateData)
    .returning('*');

  await createAuditLog(req, {
    userId,
    action: 'counter_link_updated',
    entityType: 'counter_link',
    entityId: linkId,
    oldValues: link,
    newValues: updatedLink,
  });

  res.json({
    success: true,
    message: 'Counter link updated successfully',
    data: { link: updatedLink },
  });
}

/**
 * Delete a counter link
 */
export async function deleteCounterLink(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId, linkId } = req.params;

  // Verify project ownership
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  // Get the link and verify it belongs to this project
  const link = await db('counter_links')
    .where({ id: linkId })
    .first();

  if (!link) {
    throw new NotFoundError('Counter link not found');
  }

  // Verify source counter belongs to project
  const sourceCounter = await db('counters')
    .where({ id: link.source_counter_id, project_id: projectId })
    .first();

  if (!sourceCounter) {
    throw new ForbiddenError('Link does not belong to this project');
  }

  // Delete the link
  await db('counter_links').where({ id: linkId }).del();

  await createAuditLog(req, {
    userId,
    action: 'counter_link_deleted',
    entityType: 'counter_link',
    entityId: linkId,
    oldValues: link,
  });

  res.json({
    success: true,
    message: 'Counter link deleted successfully',
  });
}

/**
 * Toggle link active status
 */
export async function toggleCounterLink(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { id: projectId, linkId } = req.params;

  // Verify project ownership
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  // Get the link
  const link = await db('counter_links')
    .where({ id: linkId })
    .first();

  if (!link) {
    throw new NotFoundError('Counter link not found');
  }

  // Verify source counter belongs to project
  const sourceCounter = await db('counters')
    .where({ id: link.source_counter_id, project_id: projectId })
    .first();

  if (!sourceCounter) {
    throw new ForbiddenError('Link does not belong to this project');
  }

  // Toggle active status
  const [updatedLink] = await db('counter_links')
    .where({ id: linkId })
    .update({
      is_active: !link.is_active,
      updated_at: new Date(),
    })
    .returning('*');

  await createAuditLog(req, {
    userId,
    action: 'counter_link_toggled',
    entityType: 'counter_link',
    entityId: linkId,
    oldValues: link,
    newValues: updatedLink,
  });

  res.json({
    success: true,
    message: `Counter link ${updatedLink.is_active ? 'activated' : 'deactivated'} successfully`,
    data: { link: updatedLink },
  });
}
