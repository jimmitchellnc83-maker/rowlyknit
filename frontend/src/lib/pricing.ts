/**
 * Frontend mirror of `backend/src/config/pricing.ts`. Single source of
 * truth for the UpgradePage pricing copy and any client-side pricing
 * calculations. Pinned to the backend constants by
 * `frontend/src/lib/__tests__/pricing.test.ts` so the two cannot drift.
 *
 * If you change these, you MUST also change `backend/src/config/pricing.ts`
 * AND update the matching Lemon Squeezy variant prices.
 */
export const PRICING_USD = {
  monthly: 12,
  annual: 80,
} as const;

export type Plan = keyof typeof PRICING_USD;
