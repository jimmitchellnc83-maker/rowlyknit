import { useEffect } from 'react';
import { ADSENSE_PUBLISHER_ID } from './adRoutes';

/**
 * Lazily inject the Google AdSense site script — but only on approved
 * routes. Previously the `<script async src="...adsbygoogle.js">` tag
 * lived in `frontend/index.html`, which meant the third-party request
 * fired on every landing / auth / admin / authenticated app load even
 * though the slots are gated to public content/tool routes. That's both
 * a performance tax on pages that never render ads AND a privacy tax on
 * users who never see one — the script sets cookies and pings Google
 * regardless of whether a slot is filled.
 *
 * Now `PublicAdSlot` calls this hook only when:
 *   - The current route is in `APPROVED_AD_ROUTES`
 *   - AND the slot id is real (non-placeholder)
 *
 * The hook is idempotent — once the `<script>` tag is in the DOM we
 * never re-add it on subsequent route changes within the same SPA
 * session. Removing the tag on navigation away from approved routes
 * would be wasted work (the script is already cached and parsed) and
 * could cancel in-flight ad fills.
 *
 * Tracking the load via a module-scoped flag (rather than a DOM query)
 * keeps the hook cheap to call from many slots on the same page.
 */
const SCRIPT_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}`;
const SCRIPT_DATA_ATTR = 'data-rowly-adsense';

let injected = false;

export function useAdSenseScript(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    if (injected) return;
    if (typeof document === 'undefined') return;

    // Defensive: if a prior render of `index.html` happened to ship
    // the tag (older deploy, manual operator override) we don't want
    // to inject a duplicate.
    const existing = document.querySelector(`script[${SCRIPT_DATA_ATTR}]`)
      ?? document.querySelector(`script[src*="adsbygoogle.js"]`);
    if (existing) {
      injected = true;
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = SCRIPT_SRC;
    script.setAttribute(SCRIPT_DATA_ATTR, 'true');
    document.head.appendChild(script);
    injected = true;
  }, [enabled]);
}

/**
 * Test-only escape hatch: resets the in-memory "have we injected" flag
 * so a unit test can assert that a fresh render injects the script
 * exactly once. Production code never calls this.
 */
export function __resetAdSenseScriptInjectionForTests(): void {
  injected = false;
}
