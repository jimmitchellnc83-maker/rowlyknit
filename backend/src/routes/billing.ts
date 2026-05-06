import { Router } from 'express';
import * as billingController from '../controllers/billingController';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

/**
 * The Lemon Squeezy webhook lives on `/api/billing/lemonsqueezy/webhook`
 * but is registered directly in `app.ts` (not on this router) because
 * it must run BEFORE `express.json` so the raw body is preserved for
 * HMAC verification. See `app.ts` for the registration site.
 */

// Authenticated routes — every billing surface here requires login.
router.use(authenticate);

/**
 * @route   GET /api/billing/status
 * @desc    Current entitlement state for the logged-in user.
 * @access  Authenticated
 */
router.get('/status', asyncHandler(billingController.getStatus));

/**
 * @route   POST /api/billing/checkout/monthly
 * @desc    Start a monthly Maker checkout session.
 * @access  Authenticated
 */
router.post('/checkout/monthly', asyncHandler(billingController.checkoutMonthly));

/**
 * @route   POST /api/billing/checkout/annual
 * @desc    Start an annual Maker checkout session.
 * @access  Authenticated
 */
router.post('/checkout/annual', asyncHandler(billingController.checkoutAnnual));

/**
 * @route   POST /api/billing/portal
 * @desc    Return the most recent customer-portal URL for this user.
 *          Lemon Squeezy embeds it in subscription webhook payloads.
 * @access  Authenticated
 */
router.post('/portal', asyncHandler(billingController.portal));

export default router;
