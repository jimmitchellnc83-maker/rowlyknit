import type { Knex } from 'knex';

/**
 * Convert pattern JSONB columns to TEXT.
 * The fields are display strings, not structured data — JSONB caused
 * double-encoding bugs (string "US 5" stored as '"US 5"').
 *
 * Migration also flattens existing JSONB content into clean strings.
 */
export async function up(knex: Knex): Promise<void> {
  // Add new TEXT columns
  await knex.schema.alterTable('patterns', (table) => {
    table.text('needle_sizes_text').nullable();
    table.text('gauge_text').nullable();
    table.text('sizes_available_text').nullable();
    table.text('yarn_requirements_text').nullable();
    table.text('source_url_text').nullable();
  });

  // Migrate existing data: convert JSONB to readable text
  const patterns = await knex('patterns').select('id', 'needle_sizes', 'gauge', 'sizes_available', 'yarn_requirements', 'source_url');

  for (const p of patterns) {
    const flatten = (val: any): string | null => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'string') {
        // Strip outer quotes if double-stringified
        try {
          const parsed = JSON.parse(val);
          if (parsed === null || parsed === undefined || parsed === '') return null;
          if (typeof parsed === 'string') return parsed;
          if (Array.isArray(parsed)) {
            if (parsed.length === 0) return null;
            return parsed.map((x: any) => {
              if (typeof x === 'string') return x;
              if (x?.name) return x.name;
              if (x?.yarnName) return [x.yarnName, x.yarnCompany, x.quantity].filter(Boolean).join(' — ');
              return JSON.stringify(x);
            }).join(', ');
          }
          if (typeof parsed === 'object') {
            return JSON.stringify(parsed);
          }
          return String(parsed);
        } catch {
          return val;
        }
      }
      if (Array.isArray(val)) {
        if (val.length === 0) return null;
        return val.map((x: any) => {
          if (typeof x === 'string') return x;
          if (x?.name) return x.name;
          return JSON.stringify(x);
        }).join(', ');
      }
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    };

    await knex('patterns').where({ id: p.id }).update({
      needle_sizes_text: flatten(p.needle_sizes),
      gauge_text: flatten(p.gauge),
      sizes_available_text: flatten(p.sizes_available),
      yarn_requirements_text: flatten(p.yarn_requirements),
      source_url_text: p.source_url,
    });
  }

  // Drop old JSONB columns and rename TEXT columns
  await knex.schema.alterTable('patterns', (table) => {
    table.dropColumn('needle_sizes');
    table.dropColumn('gauge');
    table.dropColumn('sizes_available');
    table.dropColumn('yarn_requirements');
  });

  await knex.schema.alterTable('patterns', (table) => {
    table.renameColumn('needle_sizes_text', 'needle_sizes');
    table.renameColumn('gauge_text', 'gauge');
    table.renameColumn('sizes_available_text', 'sizes_available');
    table.renameColumn('yarn_requirements_text', 'yarn_requirements');
    table.renameColumn('source_url_text', 'source_url_clean');
  });

  // We don't actually need source_url_clean; drop it
  await knex.schema.alterTable('patterns', (table) => {
    table.dropColumn('source_url_clean');
  });
}

export async function down(knex: Knex): Promise<void> {
  // Convert TEXT columns back to JSONB (best-effort, will lose nuance)
  await knex.schema.alterTable('patterns', (table) => {
    table.dropColumn('needle_sizes');
    table.dropColumn('gauge');
    table.dropColumn('sizes_available');
    table.dropColumn('yarn_requirements');
  });

  await knex.schema.alterTable('patterns', (table) => {
    table.jsonb('needle_sizes').defaultTo('[]');
    table.jsonb('gauge');
    table.jsonb('sizes_available').defaultTo('[]');
    table.jsonb('yarn_requirements').defaultTo('[]');
  });
}
