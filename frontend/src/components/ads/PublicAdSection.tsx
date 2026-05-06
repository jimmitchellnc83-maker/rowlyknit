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
 * Provisioning note (2026-05-06): the `slot` ids below are placeholders.
 * The founder needs to create matching ad units in the AdSense dashboard
 * and either edit these defaults or supply the real id at the call
 * site. Until then the `<ins>` renders empty — which is fine, AdSense
 * just doesn't fill it.
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
