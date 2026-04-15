import type { Knex } from 'knex';

/**
 * Round-2 cleanup of pattern text fields.
 *
 * Migration 37 converted JSONB → TEXT but its flatten() function only knew
 * how to handle objects with a {name} property. Several patterns still have
 * JSON-encoded blobs in needle_sizes, gauge, sizes_available, yarn_requirements:
 *
 *   yarn_requirements: {"yarnName":"...","yarnCompany":"...","quantity":null}
 *   yarn_requirements: {"fiber":"wool","weight":"worsted","yardage":400}
 *   gauge:             {"rows":28,"unit":"4 inches","stitches":20}
 *
 * This migration re-parses each value and produces a clean display string.
 */

function objectToString(x: any): string | null {
  if (x == null) return null;
  if (typeof x === 'string') return x.trim() || null;
  if (typeof x === 'number') return String(x);
  if (typeof x !== 'object') return null;

  if (x.name) return String(x.name);

  if (x.yarnName || x.yarnCompany) {
    return [x.yarnName, x.yarnCompany, x.quantity]
      .filter((v) => v != null && v !== '')
      .join(' — ') || null;
  }

  if (x.fiber || x.weight || x.yardage) {
    const yardage = x.yardage ? `${x.yardage} yds` : null;
    const composition = [x.weight, x.fiber].filter(Boolean).join(' ');
    return [composition, yardage].filter(Boolean).join(', ') || null;
  }

  if (x.stitches || x.rows) {
    const parts: string[] = [];
    if (x.stitches) parts.push(`${x.stitches} sts`);
    if (x.rows) parts.push(`${x.rows} rows`);
    let result = parts.join(' × ');
    if (x.unit) result += ` over ${x.unit}`;
    return result || null;
  }

  return null;
}

function flatten(val: any): string | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val !== 'string') return null; // We're reading TEXT columns, all strings

  const trimmed = val.trim();
  if (trimmed === '' || trimmed === '[]' || trimmed === '{}') return null;

  // If it doesn't look like JSON, leave it alone (already a clean string)
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return val;

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed === null || parsed === undefined || parsed === '') return null;
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return null;
      const parts = parsed.map(objectToString).filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : null;
    }
    if (typeof parsed === 'object') {
      return objectToString(parsed);
    }
    if (typeof parsed === 'string') return parsed;
    return String(parsed);
  } catch {
    return val; // Not valid JSON, leave as-is
  }
}

export async function up(knex: Knex): Promise<void> {
  const patterns = await knex('patterns').select(
    'id',
    'needle_sizes',
    'gauge',
    'sizes_available',
    'yarn_requirements'
  );

  for (const p of patterns) {
    const updateData: any = {};
    let changed = false;

    const ns = flatten(p.needle_sizes);
    if (ns !== p.needle_sizes) { updateData.needle_sizes = ns; changed = true; }

    const g = flatten(p.gauge);
    if (g !== p.gauge) { updateData.gauge = g; changed = true; }

    const sa = flatten(p.sizes_available);
    if (sa !== p.sizes_available) { updateData.sizes_available = sa; changed = true; }

    const yr = flatten(p.yarn_requirements);
    if (yr !== p.yarn_requirements) { updateData.yarn_requirements = yr; changed = true; }

    if (changed) {
      await knex('patterns').where({ id: p.id }).update(updateData);
    }
  }
}

export async function down(_knex: Knex): Promise<void> {
  // No-op: this is a one-way data cleanup
}
