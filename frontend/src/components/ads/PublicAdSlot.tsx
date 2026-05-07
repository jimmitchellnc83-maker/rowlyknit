import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { ADSENSE_PUBLISHER_ID, isApprovedAdRoute } from './adRoutes';
import { isRealSlotId } from './adsenseSlots';
import { useAdSenseScript } from './useAdSenseScript';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

interface PublicAdSlotProps {
  /**
   * The AdSense ad-unit slot id. Each placement on the page should have
   * its own unique slot id (provisioned via the AdSense dashboard).
   * Anything that doesn't match the real-id pattern is treated as a
   * placeholder — the `<ins>` still renders, but we don't push to
   * `adsbygoogle` (which would log a 400 to the console without ever
   * filling the slot).
   */
  slot: string;
  /** Optional className passed through to the wrapper for layout control. */
  className?: string;
  /** Test hook so the component can be addressed in unit tests. */
  testId?: string;
  /**
   * Format hint; defaults to `auto` (Google's responsive ad). The slot
   * resizes to the available width.
   */
  format?: string;
  /**
   * Whether the slot should respond to its container width. Defaults
   * to true. Set to false if you need a fixed-size unit.
   */
  responsive?: boolean;
}

/**
 * Public-only AdSense slot. Renders nothing on routes that aren't in
 * `APPROVED_AD_ROUTES` — see `adRoutes.ts` for the exact list and the
 * policy that drives it. The landing page and the authenticated app
 * never get ads even if a developer drops this component in by mistake.
 *
 * The site script is injected lazily by `useAdSenseScript` only on
 * approved routes — see that hook for the rationale (loading the script
 * site-wide would put a third-party request on every landing / auth /
 * app page even though no slot is ever filled there).
 *
 * Component responsibilities:
 *   1. Render an `<ins>` element that AdSense can fill.
 *   2. On approved routes with a real slot id, push into
 *      `window.adsbygoogle` so AdSense's loader picks the slot up.
 *   3. Suppress the push for placeholder slot ids (`rowly-*`) so a
 *      page doesn't generate console errors before the operator
 *      provisions real ad units.
 */
export default function PublicAdSlot({
  slot,
  className,
  testId = 'public-ad-slot',
  format = 'auto',
  responsive = true,
}: PublicAdSlotProps) {
  const { pathname } = useLocation();
  const ref = useRef<HTMLModElement | null>(null);
  const pushedRef = useRef(false);

  const allowed = isApprovedAdRoute(pathname);
  const realSlot = isRealSlotId(slot);

  // Inject the AdSense site script — but only on approved routes.
  // The hook is a no-op on every other route, so /, /dashboard,
  // /admin/* etc. never load `adsbygoogle.js`.
  useAdSenseScript(allowed && realSlot);

  useEffect(() => {
    if (!allowed) return;
    if (!realSlot) return; // Skip push for placeholder ids.
    if (pushedRef.current) return;
    if (typeof window === 'undefined') return;
    try {
      // The recommended pattern is to push an empty object — the
      // `adsbygoogle` script then walks the DOM, finds unfilled `<ins>`
      // tags, and slots ads in.
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushedRef.current = true;
    } catch {
      // An ad-blocker / CSP / network failure throws here. We swallow —
      // the slot stays empty, the rest of the page renders normally.
    }
  }, [allowed, realSlot]);

  if (!allowed) return null;

  return (
    <div className={className} data-testid={testId}>
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_PUBLISHER_ID}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? 'true' : 'false'}
      />
    </div>
  );
}
