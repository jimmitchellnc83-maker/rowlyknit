import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('tools', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('type', 50).notNullable(); // needle, hook, circular, dpn, accessory
    table.string('name', 255).notNullable();
    table.string('size', 100); // US 7, 4.5mm, etc.
    table.decimal('size_mm', 5, 2); // normalized size in mm
    table.string('material', 100); // bamboo, metal, wood, plastic, etc.
    table.integer('length'); // length in inches for circular needles
    table.string('brand', 255);
    table.integer('quantity').defaultTo(1);
    table.boolean('is_available').defaultTo(true);
    table.text('notes');
    table.text('photo_url');
    table.date('purchase_date');
    table.decimal('purchase_price', 10, 2);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at');

    // Indexes
    table.index('user_id');
    table.index('type');
    table.index('size_mm');
    table.index(['user_id', 'type', 'is_available']);
  });

  // Junction table for linking tools to projects
  return knex.schema.createTable('project_tools', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
    table.uuid('tool_id').notNullable().references('id').inTable('tools').onDelete('CASCADE');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('project_id');
    table.index('tool_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('project_tools');
  return knex.schema.dropTable('tools');
}
