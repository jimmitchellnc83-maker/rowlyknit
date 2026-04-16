import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Enable pg_trgm for fuzzy search
  await knex.raw('CREATE EXTENSION IF NOT EXISTS pg_trgm');

  // Normalized taxonomy tables
  await knex.schema.createTable('tool_taxonomy_categories', (table) => {
    table.string('id', 60).primary(); // e.g. 'yarn_preparation'
    table.string('label', 120).notNullable();
    table.integer('sort_order').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('tool_taxonomy_subcategories', (table) => {
    table.string('id', 60).primary(); // e.g. 'winding_and_skeining'
    table.string('category_id', 60).notNullable().references('id').inTable('tool_taxonomy_categories').onDelete('CASCADE');
    table.string('label', 120).notNullable();
    table.integer('sort_order').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('category_id');
  });

  await knex.schema.createTable('tool_taxonomy_types', (table) => {
    table.string('id', 60).primary(); // e.g. 'yarn_swift'
    table.string('subcategory_id', 60).notNullable().references('id').inTable('tool_taxonomy_subcategories').onDelete('CASCADE');
    table.string('label', 150).notNullable();
    table.specificType('applies_to', 'text[]').notNullable().defaultTo('{both}'); // knitting, crochet, both
    table.specificType('keywords', 'text[]').notNullable().defaultTo('{}');
    table.specificType('search_terms', 'text[]').notNullable().defaultTo('{}');
    table.integer('popularity').notNullable().defaultTo(0);
    table.integer('sort_order').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('subcategory_id');
  });

  await knex.schema.createTable('tool_taxonomy_synonyms', (table) => {
    table.increments('id').primary();
    table.string('synonym', 100).notNullable();
    table.string('tool_type_id', 60).notNullable().references('id').inTable('tool_taxonomy_types').onDelete('CASCADE');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('synonym');
    table.index('tool_type_id');
  });

  // Denormalized search table — one row per searchable term per tool type
  // This is the table we actually query for autocomplete
  await knex.schema.createTable('tool_taxonomy_search', (table) => {
    table.increments('id').primary();
    table.string('tool_type_id', 60).notNullable().references('id').inTable('tool_taxonomy_types').onDelete('CASCADE');
    table.string('term', 200).notNullable(); // the searchable text
    table.string('term_type', 30).notNullable(); // exact_label, keyword, search_term, synonym, subcategory, category
    table.integer('base_weight').notNullable().defaultTo(0); // pre-computed weight for this term type
    table.string('tool_label', 150).notNullable(); // denormalized for fast response
    table.string('subcategory_id', 60).notNullable();
    table.string('subcategory_label', 120).notNullable();
    table.string('category_id', 60).notNullable();
    table.string('category_label', 120).notNullable();
    table.specificType('applies_to', 'text[]').notNullable().defaultTo('{both}');
    table.integer('popularity').notNullable().defaultTo(0);

    table.index('tool_type_id');
    table.index('term_type');
  });

  // GIN trigram index on the search term for fast ILIKE / similarity queries
  await knex.raw(`
    CREATE INDEX idx_tool_taxonomy_search_term_trgm
    ON tool_taxonomy_search USING gin (term gin_trgm_ops)
  `);

  // B-tree index on lower(term) for fast prefix matching
  await knex.raw(`
    CREATE INDEX idx_tool_taxonomy_search_term_lower
    ON tool_taxonomy_search (lower(term) text_pattern_ops)
  `);

  // Track recent user searches for "popular when empty" feature
  await knex.schema.createTable('tool_taxonomy_recent_searches', (table) => {
    table.increments('id').primary();
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('tool_type_id', 60).notNullable().references('id').inTable('tool_taxonomy_types').onDelete('CASCADE');
    table.timestamp('searched_at').defaultTo(knex.fn.now());

    table.index(['user_id', 'searched_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('tool_taxonomy_recent_searches');
  await knex.schema.dropTableIfExists('tool_taxonomy_search');
  await knex.schema.dropTableIfExists('tool_taxonomy_synonyms');
  await knex.schema.dropTableIfExists('tool_taxonomy_types');
  await knex.schema.dropTableIfExists('tool_taxonomy_subcategories');
  await knex.schema.dropTableIfExists('tool_taxonomy_categories');
}
