import { Router } from 'express';
import { body } from 'express-validator';
import * as gdprController from '../controllers/gdprController';
import { authenticate } from '../middleware/auth';
import { requireSweepToken } from '../middleware/requireSweepToken';
import { validate, validateUUID } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

/**
 * @route   POST /api/gdpr/sweep
 * @desc    Execute scheduled deletions whose 30-day grace has elapsed.
 *          Token-gated for the GitHub Actions cron — declared BEFORE
 *          `router.use(authenticate)` so it doesn't require a user
 *          session.
 * @access  Bearer GDPR_SWEEP_TOKEN
 */
router.post('/sweep', requireSweepToken, asyncHandler(gdprController.runDeletionSweep));

// Everything below is for logged-in humans. Confirmation links emailed
// to the user open the front-end's /account/delete/confirm page, which
// posts the token while the user is still logged in. If they sign out
// first, they must sign in to confirm — that's intentional belt-and-
// suspenders over a rare edge case.
router.use(authenticate);

/**
 * @route   POST /api/gdpr/exports
 * @desc    Request a data export under GDPR Article 15. Body:
 *          { format: 'json' | 'csv' (default 'json') }.
 * @access  Private
 */
router.post(
  '/exports',
  [body('format').optional({ values: 'falsy' }).isIn(['json', 'csv'])],
  validate,
  asyncHandler(gdprController.createDataExport)
);

/**
 * @route   GET /api/gdpr/exports
 * @desc    List the user's recent export requests, newest first.
 * @access  Private
 */
router.get(
  '/exports',
  asyncHandler(gdprController.listDataExports)
);

/**
 * @route   GET /api/gdpr/exports/:id
 * @desc    Get the status of a single export request.
 * @access  Private (request owner only)
 */
router.get(
  '/exports/:id',
  validateUUID('id'),
  asyncHandler(gdprController.getDataExport)
);

/**
 * @route   GET /api/gdpr/exports/:id/download
 * @desc    Stream the materialised export file. Errors with 400 when
 *          the request is not yet `completed` or has expired.
 * @access  Private (request owner only)
 */
router.get(
  '/exports/:id/download',
  validateUUID('id'),
  asyncHandler(gdprController.downloadDataExport)
);

/**
 * @route   POST /api/gdpr/deletion
 * @desc    Request account deletion under GDPR Article 17. Sends a
 *          confirmation email; the actual deletion runs after a 30-day
 *          grace window unless cancelled.
 * @access  Private
 */
router.post(
  '/deletion',
  [body('reason').optional({ values: 'falsy' }).isString().isLength({ max: 500 })],
  validate,
  asyncHandler(gdprController.createDeletionRequest)
);

/**
 * @route   GET /api/gdpr/deletion
 * @desc    Get the active deletion request, or NULL when none is in
 *          flight. Drives the Profile UI's "Cancel deletion" banner.
 * @access  Private
 */
router.get(
  '/deletion',
  asyncHandler(gdprController.getActiveDeletion)
);

/**
 * @route   POST /api/gdpr/deletion/confirm
 * @desc    Confirm a pending deletion via the token mailed to the user.
 * @access  Private
 */
router.post(
  '/deletion/confirm',
  [body('token').isString().notEmpty()],
  validate,
  asyncHandler(gdprController.confirmDeletionRequest)
);

/**
 * @route   DELETE /api/gdpr/deletion
 * @desc    Cancel a pending or grace-window deletion request.
 * @access  Private
 */
router.delete(
  '/deletion',
  asyncHandler(gdprController.cancelDeletionRequest)
);

export default router;
