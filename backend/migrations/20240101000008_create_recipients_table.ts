import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('recipients', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('first_name', 100).notNullable();
    table.string('last_name', 100);
    table.string('relationship', 100); // friend, family, child, etc.
    table.date('birthday');
    table.jsonb('measurements').defaultTo('{}'); // chest, sleeve, head, foot, etc.
    table.jsonb('preferences').defaultTo('{}'); // colors, styles, fiber allergies
    table.string('clothing_size', 50);
    table.string('shoe_size', 50);
    table.text('notes');
    table.text('photo_url');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at');

    // Indexes
    table.index('user_id');
    table.index(['user_id', 'first_name', 'last_name']);
  });

  // Gift history table
  await knex.schema.createTable('gifts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('recipient_id').notNullable().references('id').inTable('recipients').onDelete('CASCADE');
    table.uuid('project_id').references('id').inTable('projects').onDelete('SET NULL');
    table.string('occasion', 100); // birthday, christmas, wedding, etc.
    table.date('date_given');
    table.text('notes');
    table.boolean('was_liked').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('recipient_id');
    table.index('project_id');
    table.index('date_given');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('gifts');
  return knex.schema.dropTable('recipients');
}
