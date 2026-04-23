/**
 * Needle Inventory Check
 *
 * Given a project's attached patterns + the user's full tool inventory,
 * compute whether the user owns every needle size the patterns require.
 * Renders as an alert chip in the ProjectDetail sidebar.
 *
 * Pure wrapper around feasibilityService's parseNeedleSizes + matchTools —
 * the tolerance + offset logic already lives there and stays the single
 * source of truth for "do I have this needle."
 */

import {
  parseNeedleSizes,
  matchTools,
  ToolRow,
  LightLevel,
  ToolMatch,
} from './feasibilityService';

export type NeedleCheckStatus = LightLevel | 'none';

export interface NeedleInventoryCheck {
  status: NeedleCheckStatus;
  requiredSizesMm: number[];
  missingSizesMm: number[];
  partialSizesMm: number[];
  matches: ToolMatch[];
  message: string;
}

export interface PatternForNeedleCheck {
  needle_sizes?: string | null;
}

export function checkNeedleInventory(
  patterns: PatternForNeedleCheck[],
  tools: ToolRow[]
): NeedleInventoryCheck {
  const required = new Set<number>();
  for (const p of patterns) {
    const parsed = parseNeedleSizes(p.needle_sizes ?? null);
    for (const mm of parsed.sizesMm) required.add(mm);
  }
  const requiredSizesMm = [...required].sort((a, b) => a - b);

  if (requiredSizesMm.length === 0) {
    return {
      status: 'none',
      requiredSizesMm: [],
      missingSizesMm: [],
      partialSizesMm: [],
      matches: [],
      message: 'No needle sizes specified on any attached pattern.',
    };
  }

  const matches = matchTools(requiredSizesMm, tools);
  const missingSizesMm = matches.filter((m) => m.status === 'red').map((m) => m.sizeMm);
  const partialSizesMm = matches.filter((m) => m.status === 'yellow').map((m) => m.sizeMm);

  let status: NeedleCheckStatus;
  if (missingSizesMm.length > 0) status = 'red';
  else if (partialSizesMm.length > 0) status = 'yellow';
  else status = 'green';

  const message = buildMessage(status, requiredSizesMm, missingSizesMm, partialSizesMm);

  return {
    status,
    requiredSizesMm,
    missingSizesMm,
    partialSizesMm,
    matches,
    message,
  };
}

function formatMm(sizes: number[]): string {
  return sizes.map((s) => `${s}mm`).join(', ');
}

function buildMessage(
  status: NeedleCheckStatus,
  required: number[],
  missing: number[],
  partial: number[]
): string {
  if (status === 'red') {
    return `Missing ${formatMm(missing)} — required by this project's pattern${required.length > 1 ? 's' : ''}.`;
  }
  if (status === 'yellow') {
    return `Close match only for ${formatMm(partial)} — exact size not in your inventory.`;
  }
  return `All ${required.length} required needle size${required.length === 1 ? '' : 's'} in your inventory.`;
}
