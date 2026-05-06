/**
 * Frontend mirror of `backend/src/config/adsenseSlots.ts`.
 *
 * The operator provisions a real AdSense ad unit per approved tool route
 * and pastes the resulting numeric slot id into the matching
 * `VITE_ADSENSE_SLOT_*` env var. Until they do, every call site falls
 * back to a `rowly-<tool>` placeholder string — Google never fills the
 * placeholder, so the slot stays an empty rectangle.
 *
 * The placeholder values are kept in sync with the route allowlist in
 * `adRoutes.ts`. The dashboard's AdSense readiness card calls them out
 * by name when slots are still unconfigured.
 */

const PLACEHOLDER_PREFIX = 'rowly-';

interface SlotDef {
  /** Tool id, also used as the placeholder suffix. */
  tool: string;
  /** Vite env var the operator can set to the real numeric slot id. */
  envName: string;
}

export const SLOT_DEFS: readonly SlotDef[] = [
  { tool: 'calculators-index', envName: 'VITE_ADSENSE_SLOT_CALCULATORS_INDEX' },
  { tool: 'gauge', envName: 'VITE_ADSENSE_SLOT_GAUGE' },
  { tool: 'size', envName: 'VITE_ADSENSE_SLOT_SIZE' },
  { tool: 'yardage', envName: 'VITE_ADSENSE_SLOT_YARDAGE' },
  { tool: 'row-repeat', envName: 'VITE_ADSENSE_SLOT_ROW_REPEAT' },
  { tool: 'shaping', envName: 'VITE_ADSENSE_SLOT_SHAPING' },
  { tool: 'glossary', envName: 'VITE_ADSENSE_SLOT_GLOSSARY' },
  { tool: 'knit911', envName: 'VITE_ADSENSE_SLOT_KNIT911' },
] as const;

const REAL_SLOT_ID = /^[0-9]{6,}$/;

function readEnv(envName: string): string | undefined {
  // Vite's `import.meta.env` is statically replaced at build time. We
  // look the value up from the literal record to avoid any `process.env`
  // shenanigans in the SSR path.
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  return env[envName];
}

/**
 * Returns the slot id to render for the given tool. If the operator
 * has set the matching env var to a real numeric id we use that;
 * otherwise we fall back to the placeholder. Never throws.
 */
export function getAdSlotId(tool: string): string {
  const def = SLOT_DEFS.find((s) => s.tool === tool);
  if (!def) return `${PLACEHOLDER_PREFIX}${tool}`;
  const fromEnv = readEnv(def.envName)?.trim();
  if (fromEnv && REAL_SLOT_ID.test(fromEnv)) return fromEnv;
  return `${PLACEHOLDER_PREFIX}${tool}`;
}

/**
 * True when the slot id passed in looks like a real (non-placeholder)
 * AdSense unit id. The Public ad slot component uses this to skip
 * pushing into `adsbygoogle` when only the placeholder is available —
 * pushing a placeholder logs a 400 to the console without earning anything.
 */
export function isRealSlotId(slot: string): boolean {
  if (typeof slot !== 'string' || slot.length === 0) return false;
  if (slot.startsWith(PLACEHOLDER_PREFIX)) return false;
  return REAL_SLOT_ID.test(slot.trim());
}
