/**
 * Single source of truth for Rowly Maker subscription pricing in USD.
 *
 * The actual money flows through Lemon Squeezy variants — the variant IDs
 * live in env (`LEMONSQUEEZY_*_VARIANT_ID`) and the prices are stored on
 * the Lemon Squeezy side. These constants only have to MATCH the
 * configured LS variants so the page advertises the same price the
 * customer pays at checkout.
 *
 * Drift risk: if the operator changes a price in the LS dashboard they
 * must also update these values and ship a deploy. Long-term we plan a
 * startup ping that reads variant `unit_price` from the LS API and
 * asserts it matches; until then the dashboard's revenue card surfaces
 * these literals so the founder can spot-check them on every visit.
 *
 * Mirrored on the frontend in `frontend/src/lib/pricing.ts` — a
 * `pricing.test.ts` pin asserts the two stay in sync.
 */
export const PRICING_USD = {
  monthly: 12,
  annual: 80,
} as const;

export type Plan = keyof typeof PRICING_USD;

/** Monthly equivalent of the annual plan, used for MRR math. */
export const ANNUAL_AS_MONTHLY_USD = PRICING_USD.annual / 12;
