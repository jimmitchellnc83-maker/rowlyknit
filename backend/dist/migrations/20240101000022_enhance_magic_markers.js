"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    // Enhance magic_markers table with row ranges, repeating intervals, and priority
    await knex.schema.alterTable('magic_markers', (table) => {
        // Row range support - "At the same time" reminders
        table.integer('start_row').nullable();
        table.integer('end_row').nullable();
        // Repeating interval support
        table.integer('repeat_interval').nullable(); // Every X rows
        table.integer('repeat_offset').nullable().defaultTo(0); // Start offset for repeat
        table.boolean('is_repeating').defaultTo(false);
        // Enhanced alert options
        table.string('priority', 20).defaultTo('normal'); // 'low', 'normal', 'high', 'critical'
        table.string('display_style', 50).defaultTo('banner'); // 'banner', 'popup', 'toast', 'inline'
        table.string('color', 20).nullable(); // Custom color for the marker
        // Snooze functionality
        table.timestamp('snoozed_until').nullable();
        table.integer('snooze_count').defaultTo(0);
        // Completion tracking for one-time markers
        table.boolean('is_completed').defaultTo(false);
        table.timestamp('completed_at').nullable();
        // Better categorization
        table.string('category', 50).defaultTo('reminder'); // 'reminder', 'at_same_time', 'milestone', 'shaping', 'note'
        // Track how many times triggered
        table.integer('trigger_count').defaultTo(0);
        // Name field (if not already present)
        table.string('name', 255).nullable();
        // Updated timestamp
        table.timestamp('updated_at').nullable();
    });
    // Add indexes for efficient querying
    await knex.schema.alterTable('magic_markers', (table) => {
        table.index('start_row');
        table.index('end_row');
        table.index('priority');
        table.index('category');
        table.index(['project_id', 'category']);
        table.index(['project_id', 'priority', 'is_active']);
    });
}
async function down(knex) {
    await knex.schema.alterTable('magic_markers', (table) => {
        // Remove indexes
        table.dropIndex(['project_id', 'priority', 'is_active']);
        table.dropIndex(['project_id', 'category']);
        table.dropIndex('category');
        table.dropIndex('priority');
        table.dropIndex('end_row');
        table.dropIndex('start_row');
        // Remove columns
        table.dropColumn('updated_at');
        table.dropColumn('name');
        table.dropColumn('trigger_count');
        table.dropColumn('category');
        table.dropColumn('completed_at');
        table.dropColumn('is_completed');
        table.dropColumn('snooze_count');
        table.dropColumn('snoozed_until');
        table.dropColumn('color');
        table.dropColumn('display_style');
        table.dropColumn('priority');
        table.dropColumn('is_repeating');
        table.dropColumn('repeat_offset');
        table.dropColumn('repeat_interval');
        table.dropColumn('end_row');
        table.dropColumn('start_row');
    });
}
