/**
 * AdSense ad-unit slot configuration.
 *
 * Real AdSense slot ids are 10-digit numbers issued by Google when the
 * operator creates an ad unit in the AdSense dashboard. Until those are
 * provisioned, every call site uses a `rowly-<tool>` PLACEHOLDER string
 * — the `<ins>` still renders, but Google will never fill it. The
 * dashboard cannot honestly call AdSense "ready" while placeholders are
 * still in the wild.
 *
 * Both halves (frontend reads VITE_ADSENSE_SLOT_*, backend reads
 * ADSENSE_SLOT_*) read from the operator's env. The backend dashboard
 * uses these env vars to verify the operator has provisioned a real
 * slot id for every approved ad route — see
 * `frontend/src/components/ads/adRoutes.ts` for the route allowlist.
 *
 * Detection: a real id matches `/^[0-9]{6,}$/` (numeric, six+ digits).
 * Anything starting with `rowly-` or otherwise non-numeric is treated as
 * unconfigured.
 */

/** Each tool / public route gets its own ad unit so the operator can A/B
 * test placement without changing code. The map below pins the
 * env var names — if a route is added to `APPROVED_AD_ROUTES` but no
 * env var is added here, the dashboard surfaces it as unconfigured.
 */
export const ADSENSE_SLOT_ENV_BY_TOOL: Readonly<Record<string, string>> = {
  'calculators-index': 'ADSENSE_SLOT_CALCULATORS_INDEX',
  gauge: 'ADSENSE_SLOT_GAUGE',
  size: 'ADSENSE_SLOT_SIZE',
  yardage: 'ADSENSE_SLOT_YARDAGE',
  'row-repeat': 'ADSENSE_SLOT_ROW_REPEAT',
  shaping: 'ADSENSE_SLOT_SHAPING',
  glossary: 'ADSENSE_SLOT_GLOSSARY',
  knit911: 'ADSENSE_SLOT_KNIT911',
} as const;

/** A real AdSense slot id is purely numeric and at least 6 digits. */
const REAL_SLOT_ID = /^[0-9]{6,}$/;

/**
 * Checks whether the given env var name resolves to a real (non-placeholder)
 * AdSense slot id. Returns false for `undefined`, empty string, or any
 * value starting with `rowly-` (placeholder), or any value that doesn't
 * match the numeric AdSense pattern.
 */
export function isAdSenseSlotConfigured(envName: string): boolean {
  const v = process.env[envName];
  if (typeof v !== 'string' || v.length === 0) return false;
  if (v.startsWith('rowly-')) return false;
  return REAL_SLOT_ID.test(v.trim());
}

/**
 * Returns a per-tool configuration report. Each entry tells the
 * dashboard whether a real id has been provisioned for that tool, and
 * if not what env var the operator needs to set.
 */
export function buildSlotConfigReport(): Array<{
  tool: string;
  envName: string;
  configured: boolean;
  value: string | null;
}> {
  return Object.entries(ADSENSE_SLOT_ENV_BY_TOOL).map(([tool, envName]) => {
    const raw = process.env[envName];
    const value = typeof raw === 'string' && raw.length > 0 ? raw : null;
    return {
      tool,
      envName,
      configured: isAdSenseSlotConfigured(envName),
      value,
    };
  });
}

/**
 * True only when EVERY tool in `ADSENSE_SLOT_ENV_BY_TOOL` has a real
 * (non-placeholder) slot id provisioned via env. The dashboard requires
 * this before it will report AdSense "ready".
 */
export function allAdSenseSlotsConfigured(): boolean {
  return buildSlotConfigReport().every((r) => r.configured);
}
