import PublicAdSlot from './PublicAdSlot';

/**
 * Page-level wrapper for `PublicAdSlot`. Stamps the slot inside a
 * compact section that visually fits the existing calculator page
 * layout (rounded card, neutral border, "Ad" label so visitors know
 * what they're looking at).
 *
 * The component is route-gated by `PublicAdSlot` itself — dropping
 * `<PublicAdSection />` into the wrong place is a no-op rather than a
 * policy violation. See `adRoutes.ts` for the allowlist.
 *
 * Slot id sourcing: callers must pass the slot prop as
 * `getAdSlotId('<tool>')` from `adsenseSlots.ts` so the operator's
 * `VITE_ADSENSE_SLOT_<TOOL>` env var (when set to a real numeric id)
 * flows through to the rendered `<ins data-ad-slot>`. The
 * `noHardcodedRowlySlots` regression test fails if a page ever ships a
 * hardcoded placeholder like `rowly-gauge` as a JSX prop literal again.
 */
export default function PublicAdSection({
  slot = 'rowly-public-default',
  label = 'Sponsored',
  testId,
}: {
  slot?: string;
  label?: string;
  testId?: string;
}) {
  return (
    <section
      className="rounded-lg border border-gray-200 bg-white/60 p-3 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-400"
      aria-label="Sponsored content"
    >
      <div className="mb-2 uppercase tracking-wide">{label}</div>
      <PublicAdSlot slot={slot} testId={testId} />
    </section>
  );
}
