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
 * when total hits 0, the button is hidden. Also returns the onboarding
 * goal so Dashboard can decide whether to surface the goal-pick card.
 */
export async function getExampleCount(req: Request, res: Response) {
  const userId = req.user!.userId;
  const user = await db('users')
    .select([
      'examples_seeded_at',
      'examples_cleared_at',
      'tour_completed_at',
      'onboarding_goal',
    ])
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
      onboardingGoal: user?.onboarding_goal ?? null,
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

/**
 * Whitelisted onboarding-goal values. Anything else is rejected at the
 * route layer and again here as a defensive check. The set is small and
 * stable; if it grows past ~10 entries, lift it into a dedicated module.
 */
export const ONBOARDING_GOALS = [
  'track_project',
  'organize_stash',
  'follow_pattern',
  'design_new',
  'explore_examples',
] as const;
export type OnboardingGoal = (typeof ONBOARDING_GOALS)[number];

/**
 * Persist the answer to the post-registration "What do you want to do
 * first?" card. Called once per user under normal use; passing null
 * resets so the card shows again (used by Profile → Onboarding).
 */
export async function setOnboardingGoal(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { goal } = req.body as { goal?: string | null };
  const value: OnboardingGoal | null =
    goal === null || goal === undefined
      ? null
      : (ONBOARDING_GOALS as readonly string[]).includes(goal)
        ? (goal as OnboardingGoal)
        : null;
  if (goal && value === null) {
    res.status(400).json({
      success: false,
      error: { message: `Unknown onboarding goal: ${goal}` },
    });
    return;
  }
  await db('users')
    .where({ id: userId })
    .update({ onboarding_goal: value, updated_at: new Date() });
  res.json({
    success: true,
    data: { onboardingGoal: value },
  });
}
