import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Add category column (nullable initially for migration)
  await knex.schema.alterTable('tools', (table) => {
    table.string('category', 50);
  });

  // 2. Migrate existing type values to new category + type
  await knex.raw(`
    UPDATE tools SET category = 'knitting_needles', type = 'straight_needle' WHERE type = 'needle';
    UPDATE tools SET category = 'knitting_needles', type = 'circular_needle' WHERE type = 'circular';
    UPDATE tools SET category = 'knitting_needles' WHERE type = 'dpn';
    UPDATE tools SET category = 'crochet_hooks', type = 'standard_hook' WHERE type = 'hook';
    UPDATE tools SET category = 'other', type = 'other' WHERE type = 'accessory';
  `);

  // 3. Set any remaining rows without a category to 'other'
  await knex('tools').whereNull('category').update({ category: 'other' });

  // 4. Make category NOT NULL
  await knex.schema.alterTable('tools', (table) => {
    table.string('category', 50).notNullable().defaultTo('other').alter();
  });

  // 5. Add indexes
  await knex.schema.alterTable('tools', (table) => {
    table.index('category');
    table.index(['user_id', 'category', 'is_available']);
  });
}

export async function down(knex: Knex): Promise<void> {
  // Reverse the type migration
  await knex.raw(`
    UPDATE tools SET type = 'needle' WHERE type = 'straight_needle';
    UPDATE tools SET type = 'circular' WHERE type = 'circular_needle';
    UPDATE tools SET type = 'hook' WHERE type = 'standard_hook';
    UPDATE tools SET type = 'accessory' WHERE type = 'other' AND category = 'other';
  `);

  await knex.schema.alterTable('tools', (table) => {
    table.dropIndex(['user_id', 'category', 'is_available']);
    table.dropIndex('category');
    table.dropColumn('category');
  });
}
