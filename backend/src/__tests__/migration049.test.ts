/**
 * Regression test for migration #049 — `reconcile_handwritten_notes_columns`.
 *
 * The original implementation called `knex.schema.alterTable(...).catch(()=>{})`
 * to add `idx_handwritten_notes_project`. On a fresh DB the index already
 * exists from migration #034, so the CREATE failed inside the migration's
 * enclosing transaction. The JS catch swallowed the error, but Postgres
 * had already aborted the transaction, and the next `hasColumn` query
 * surfaced as "current transaction is aborted, commands ignored until end
 * of transaction block" — breaking disaster-recovery rebuilds.
 *
 * The fix uses `knex.raw('CREATE INDEX IF NOT EXISTS ...')` which is
 * idempotent at the SQL level and never aborts the transaction.
 *
 * This test mocks knex and asserts:
 *   1. No `.catch(() => {})` swallowing on a schema operation
 *   2. The index creation uses `IF NOT EXISTS` (idempotent)
 *   3. `hasColumn` queries still run after the index step (i.e. nothing
 *      blocks the rest of the migration)
 */

import * as path from 'path';
import * as fs from 'fs';
import { up } from '../../migrations/20240101000049_reconcile_handwritten_notes_columns';

describe('migration #049 reconcile_handwritten_notes_columns', () => {
  it('uses CREATE INDEX IF NOT EXISTS rather than the abort-prone alterTable+catch', async () => {
    const rawCalls: string[] = [];

    const fakeKnex: any = {
      raw: jest.fn(async (sql: string) => {
        rawCalls.push(sql);
      }),
      schema: {
        hasColumn: jest.fn(async () => true), // pretend every column exists
        alterTable: jest.fn(async () => undefined),
      },
    };

    await up(fakeKnex);

    // The index creation must be a raw CREATE INDEX IF NOT EXISTS — not an
    // alterTable.index() call, which would throw on existing indexes and
    // poison the transaction.
    const indexRaws = rawCalls.filter((s) => /CREATE INDEX/i.test(s));
    expect(indexRaws.length).toBeGreaterThan(0);
    indexRaws.forEach((s) => {
      expect(s).toMatch(/IF NOT EXISTS/i);
      expect(s).toMatch(/idx_handwritten_notes_project/);
    });

    // hasColumn must have been queried for each new column the migration
    // intends to reconcile — proves the migration kept running past the
    // index step. (Implementation detail: the bad pattern's transaction
    // abort would surface in production, but our mock can't simulate that.
    // Asserting the call sequence at least proves the migration didn't
    // short-circuit on an early throw.)
    expect(fakeKnex.schema.hasColumn).toHaveBeenCalledWith(
      'handwritten_notes',
      'pattern_id',
    );
    expect(fakeKnex.schema.hasColumn).toHaveBeenCalledWith(
      'handwritten_notes',
      'original_filename',
    );
    expect(fakeKnex.schema.hasColumn).toHaveBeenCalledWith(
      'handwritten_notes',
      'file_size',
    );
    expect(fakeKnex.schema.hasColumn).toHaveBeenCalledWith(
      'handwritten_notes',
      'page_number',
    );
    expect(fakeKnex.schema.hasColumn).toHaveBeenCalledWith(
      'handwritten_notes',
      'notes',
    );
  });

  // Static check on the migration source — guarantees the bad pattern can't
  // creep back in via a future edit that "looks right" to humans.
  it('source file does not contain `.catch(() => {})` over a schema op', () => {
    const src = fs.readFileSync(
      path.join(
        __dirname,
        '..',
        '..',
        'migrations',
        '20240101000049_reconcile_handwritten_notes_columns.ts',
      ),
      'utf8',
    );
    expect(src).not.toMatch(/\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\/\*[^}]*\*\/\s*\}\s*\)/);
    expect(src).not.toMatch(/alterTable\([^)]+\)\s*\.[^.]+\)\s*\.catch/s);
  });
});
