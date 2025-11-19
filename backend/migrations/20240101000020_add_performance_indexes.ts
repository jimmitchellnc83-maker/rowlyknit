import type { Knex } from 'knex';

/**
 * Performance Optimization Migration
 * Adds additional indexes for common query patterns and performance improvements
 * - Soft delete filtering
 * - Full-text search
 * - JSONB field searches
 * - Composite indexes for complex queries
 * - Updated timestamp queries
 */

// Disable transactions for this migration because CREATE INDEX CONCURRENTLY
// cannot run inside a transaction block
export const config = { transaction: false };

export async function up(knex: Knex): Promise<void> {
  // Users table indexes
  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS users_deleted_at_idx
    ON users (deleted_at)
    WHERE deleted_at IS NULL;
  `);

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS users_last_login_idx
    ON users (last_login DESC);
  `);

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS users_preferences_idx
    ON users USING gin (preferences);
  `);

  // Projects table indexes
  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS projects_deleted_at_idx
    ON projects (deleted_at)
    WHERE deleted_at IS NULL;
  `);

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS projects_updated_at_idx
    ON projects (updated_at DESC);
  `);

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS projects_name_trgm_idx
    ON projects USING gin (name gin_trgm_ops);
  `);

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS projects_tags_idx
    ON projects USING gin (tags);
  `);

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS projects_metadata_idx
    ON projects USING gin (metadata);
  `);

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS projects_user_status_created_idx
    ON projects (user_id, status, created_at DESC);
  `);

  // Patterns table indexes
  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS patterns_deleted_at_idx
    ON patterns (deleted_at)
    WHERE deleted_at IS NULL;
  `);

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS patterns_updated_at_idx
    ON patterns (updated_at DESC);
  `);

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS patterns_name_trgm_idx
    ON patterns USING gin (name gin_trgm_ops);
  `);

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS patterns_description_trgm_idx
    ON patterns USING gin (description gin_trgm_ops);
  `);

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS patterns_tags_idx
    ON patterns USING gin (tags);
  `);

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS patterns_designer_idx
    ON patterns (designer);
  `);

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS patterns_user_category_favorite_idx
    ON patterns (user_id, category, is_favorite);
  `);

  // Yarn table indexes
  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS yarn_deleted_at_idx
    ON yarn (deleted_at)
    WHERE deleted_at IS NULL;
  `);

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS yarn_updated_at_idx
    ON yarn (updated_at DESC);
  `);

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS yarn_name_trgm_idx
    ON yarn USING gin (name gin_trgm_ops);
  `);

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS yarn_tags_idx
    ON yarn USING gin (tags);
  `);

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS yarn_low_stock_idx
    ON yarn (user_id, low_stock_alert)
    WHERE low_stock_alert = true;
  `);

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS yarn_color_idx
    ON yarn (color);
  `);

  // Pattern bookmarks indexes
  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS pattern_bookmarks_created_at_idx
    ON pattern_bookmarks (created_at DESC);
  `);

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS pattern_bookmarks_page_idx
    ON pattern_bookmarks (pattern_id, page_number);
  `);

  // Pattern annotations indexes
  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS pattern_annotations_type_idx
    ON pattern_annotations (annotation_type);
  `);

  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS pattern_annotations_data_idx
    ON pattern_annotations USING gin (data);
  `);

  // Audit logs - add partition-friendly composite index
  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_logs_user_action_created_idx
    ON audit_logs (user_id, action, created_at DESC);
  `);

  // Counter history - optimize for recent history queries
  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS counter_history_created_desc_idx
    ON counter_history (created_at DESC);
  `);

  // Sessions - add index for cleanup queries
  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS sessions_revoked_expires_idx
    ON sessions (is_revoked, expires_at)
    WHERE is_revoked = false;
  `);

  // Tokens - optimize expired token cleanup
  await knex.raw(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS tokens_type_used_expires_idx
    ON tokens (type, is_used, expires_at)
    WHERE is_used = false;
  `);

  // Enable pg_trgm extension for trigram text search if not already enabled
  await knex.raw('CREATE EXTENSION IF NOT EXISTS pg_trgm;');
}

export async function down(knex: Knex): Promise<void> {
  // Drop all indexes created in up()
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS users_deleted_at_idx;');
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS users_last_login_idx;');
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS users_preferences_idx;');

  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS projects_deleted_at_idx;');
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS projects_updated_at_idx;');
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS projects_name_trgm_idx;');
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS projects_tags_idx;');
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS projects_metadata_idx;');
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS projects_user_status_created_idx;');

  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS patterns_deleted_at_idx;');
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS patterns_updated_at_idx;');
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS patterns_name_trgm_idx;');
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS patterns_description_trgm_idx;');
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS patterns_tags_idx;');
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS patterns_designer_idx;');
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS patterns_user_category_favorite_idx;');

  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS yarn_deleted_at_idx;');
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS yarn_updated_at_idx;');
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS yarn_name_trgm_idx;');
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS yarn_tags_idx;');
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS yarn_low_stock_idx;');
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS yarn_color_idx;');

  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS pattern_bookmarks_created_at_idx;');
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS pattern_bookmarks_page_idx;');

  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS pattern_annotations_type_idx;');
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS pattern_annotations_data_idx;');

  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS audit_logs_user_action_created_idx;');
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS counter_history_created_desc_idx;');
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS sessions_revoked_expires_idx;');
  await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS tokens_type_used_expires_idx;');
}
