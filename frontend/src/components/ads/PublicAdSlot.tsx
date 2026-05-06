import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { ADSENSE_PUBLISHER_ID, isApprovedAdRoute } from './adRoutes';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

interface PublicAdSlotProps {
  /**
   * The AdSense ad-unit slot id. Each placement on the page should have
   * its own unique slot id (provisioned via the AdSense dashboard).
   * For the initial rollout we use a single shared "responsive" slot
   * across calculator pages — the operator can split this later.
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
 * The site script loads from `index.html` regardless of route, so this
 * component only has to deal with two concerns:
 *   1. Render an `<ins>` element that AdSense can fill.
 *   2. Push the slot into `window.adsbygoogle` once on mount, but only
 *      after the route guard passes. If `adsbygoogle` isn't loaded yet
 *      (slow network, ad-blocker), the push is a no-op and we silently
 *      degrade — same as Google's recommended snippet.
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

  useEffect(() => {
    if (!allowed) return;
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
  }, [allowed]);

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
