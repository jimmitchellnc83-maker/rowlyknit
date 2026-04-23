import { Request, Response } from 'express';
import db from '../config/database';
import {
  clearExampleDataForUser,
  countExampleData,
} from '../services/seedExampleData';
import { createAuditLog } from '../middleware/auditLog';

/**
 * Read the current count + per-type breakdown of example rows for the
 * logged-in user. Drives the "Clear N example items" button in Profile:
 * when total hits 0, the button is hidden.
 */
export async function getExampleCount(req: Request, res: Response) {
  const userId = req.user!.userId;
  const user = await db('users')
    .select(['examples_seeded_at', 'examples_cleared_at', 'tour_completed_at'])
    .where({ id: userId })
    .first();
  const { total, breakdown } = await countExampleData(userId);
  res.json({
    success: true,
    data: {
      total,
      breakdown,
      seededAt: user?.examples_seeded_at ?? null,
      clearedAt: user?.examples_cleared_at ?? null,
      tourCompletedAt: user?.tour_completed_at ?? null,
    },
  });
}

/**
 * Nuke every example-tagged row for the logged-in user. Child entities
 * cascade from the parent deletes (counters, panel_groups, panels, sessions,
 * markers, ratings, pieces). Marks `users.examples_cleared_at`.
 */
export async function clearExamples(req: Request, res: Response) {
  const userId = req.user!.userId;
  const deleted = await clearExampleDataForUser(userId);
  await createAuditLog(req, {
    userId,
    action: 'example_data_cleared',
    entityType: 'user',
    entityId: userId,
    newValues: deleted,
  });
  res.json({
    success: true,
    message: 'Example data cleared.',
    data: { deleted },
  });
}

/**
 * Mark the guided tour as completed (or un-completed, if the user wants
 * to see it again). Called on tour finish/skip + from the "Restart tour"
 * button in Profile.
 */
export async function setTourCompleted(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { completed } = req.body as { completed?: boolean };
  const timestamp = completed === false ? null : new Date();
  await db('users')
    .where({ id: userId })
    .update({ tour_completed_at: timestamp, updated_at: new Date() });
  res.json({
    success: true,
    data: { tourCompletedAt: timestamp },
  });
}
