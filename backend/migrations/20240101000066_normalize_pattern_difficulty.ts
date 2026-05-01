import { Knex } from 'knex';

// Align patterns.difficulty with Craft Yarn Council canonical 4-tier scale:
//   basic / easy / intermediate / complex
// Legacy mapping:
//   beginner    -> basic
//   advanced    -> complex
//   expert      -> complex
//   experienced -> complex

export async function up(knex: Knex): Promise<void> {
  await knex('patterns').where({ difficulty: 'beginner' }).update({ difficulty: 'basic' });
  await knex('patterns')
    .whereIn('difficulty', ['advanced', 'expert', 'experienced'])
    .update({ difficulty: 'complex' });
}

export async function down(knex: Knex): Promise<void> {
  // Best-effort reverse. Rows that were originally 'expert' or 'experienced'
  // collapse onto 'advanced' since the up-migration discards that distinction.
  await knex('patterns').where({ difficulty: 'basic' }).update({ difficulty: 'beginner' });
  await knex('patterns').where({ difficulty: 'complex' }).update({ difficulty: 'advanced' });
}
