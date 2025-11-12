import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('yarn', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('brand', 255);
    table.string('line', 255); // yarn line/collection
    table.string('name', 255).notNullable();
    table.string('color', 255);
    table.string('color_code', 100);
    table.string('weight', 50); // lace, fingering, sport, DK, worsted, bulky, etc.
    table.string('fiber_content', 255);
    table.integer('yards_total');
    table.integer('yards_remaining');
    table.integer('grams_total');
    table.integer('grams_remaining');
    table.integer('skeins_total').defaultTo(1);
    table.integer('skeins_remaining').defaultTo(1);
    table.decimal('price_per_skein', 10, 2);
    table.date('purchase_date');
    table.string('purchase_location', 255);
    table.string('dye_lot', 100);
    table.text('photo_url');
    table.text('thumbnail_url');
    table.text('notes');
    table.jsonb('tags').defaultTo('[]');
    table.boolean('is_favorite').defaultTo(false);
    table.boolean('is_stash').defaultTo(true); // false if all used
    table.boolean('low_stock_alert').defaultTo(false);
    table.integer('low_stock_threshold').defaultTo(100); // yards
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at');

    // Indexes
    table.index('user_id');
    table.index('weight');
    table.index('brand');
    table.index(['user_id', 'is_stash']);
    table.index(['user_id', 'is_favorite']);
  });

  // Junction table for linking yarn to projects
  return knex.schema.createTable('project_yarn', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
    table.uuid('yarn_id').notNullable().references('id').inTable('yarn').onDelete('CASCADE');
    table.integer('yards_used');
    table.integer('skeins_used');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('project_id');
    table.index('yarn_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('project_yarn');
  return knex.schema.dropTable('yarn');
}
