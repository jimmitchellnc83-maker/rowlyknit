/**
 * Voice grammar for Panel Mode.
 *
 * Returns a structured intent from a raw speech transcript. The consumer
 * resolves `read` targets against the current panel set (so "read cable A"
 * works even though this grammar has no idea what panels exist).
 */

export type PanelVoiceIntent =
  | { kind: 'advance' }
  | { kind: 'retreat' }
  | { kind: 'jump'; row: number }
  | { kind: 'read'; target: 'all' | string }
  | { kind: 'where' }
  | { kind: 'stop' };

const JUMP_RE = /\b(?:jump|go)(?:\s+to)?(?:\s+row)?\s+(\d+)\b/i;
const READ_ALL_RE =
  /\b(?:read\s+(?:all|everything|instructions?|it)|what\s+(?:do|should)\s+i\s+(?:read|knit|do))\b/i;
const READ_TARGET_RE = /\bread\s+(?:panel\s+)?(.{1,40}?)(?:\s+panel)?$/i;
const WHERE_RE = /\b(where\s+am\s+i|status|how\s+far)\b/i;
const STOP_RE = /\b(stop|pause|silence|quiet)\b/i;
const ADVANCE_RE =
  /\b(next(?:\s+row)?|advance|forward|mark|tick|plus|another)\b/i;
const RETREAT_RE =
  /\b(back(?:\s+one)?|undo|previous|oops|mistake|rewind)\b/i;

export function matchPanelVoiceIntent(transcript: string): PanelVoiceIntent | null {
  const s = transcript.trim();
  if (!s) return null;

  // Order matters: more specific intents first.

  // Stop/pause is a kill-switch — check before other verbs.
  if (STOP_RE.test(s)) return { kind: 'stop' };

  // Jump to row N — must come before generic advance/retreat.
  const jumpMatch = s.match(JUMP_RE);
  if (jumpMatch) {
    const row = parseInt(jumpMatch[1], 10);
    if (Number.isFinite(row) && row > 0) return { kind: 'jump', row };
  }

  // "read all" must beat "read <name>" because "all" would otherwise be
  // interpreted as a panel name.
  if (READ_ALL_RE.test(s)) return { kind: 'read', target: 'all' };

  // "where am I" — status query.
  if (WHERE_RE.test(s)) return { kind: 'where' };

  // "read <panel name>" — captures trailing text as the panel query for the
  // consumer to fuzzy-match.
  const readMatch = s.match(READ_TARGET_RE);
  if (readMatch) {
    const target = readMatch[1].trim().toLowerCase();
    // Guard: "read panel" with no name degrades to "read all" rather than a
    // nonsense target.
    if (target.length > 0 && target !== 'panel') {
      return { kind: 'read', target };
    }
  }

  // Advance / retreat — checked last because their keywords (next, back) are
  // the most permissive.
  if (ADVANCE_RE.test(s)) return { kind: 'advance' };
  if (RETREAT_RE.test(s)) return { kind: 'retreat' };

  return null;
}

/**
 * Fuzzy-match a spoken target against a list of panel names.
 * Used by the consumer after the grammar emits `{ kind: 'read', target }`.
 *
 * Matches in order: exact (case-insensitive) → starts-with → contains.
 * Returns the matched panel name, or null if nothing plausible.
 */
export function resolveReadTarget(
  target: string,
  panelNames: readonly string[],
): string | null {
  const normalized = target.toLowerCase().trim();
  if (!normalized || panelNames.length === 0) return null;

  const lowered = panelNames.map((n) => ({ name: n, lc: n.toLowerCase() }));

  const exact = lowered.find((p) => p.lc === normalized);
  if (exact) return exact.name;

  const startsWith = lowered.find((p) => p.lc.startsWith(normalized));
  if (startsWith) return startsWith.name;

  const contains = lowered.find(
    (p) => p.lc.includes(normalized) || normalized.includes(p.lc),
  );
  if (contains) return contains.name;

  return null;
}
