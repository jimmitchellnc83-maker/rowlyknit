/**
 * Regression tests for the JSONB stringify bug at notesController.ts:643 + :698,
 * found in the platform audit 2026-04-30 (Critical #2). Without JSON.stringify
 * the pg driver serialises a JS array as a Postgres array literal and rejects
 * the insert against the jsonb column with a 500.
 */

const projectFirst = jest.fn();
const patternFirst = jest.fn();
const textNoteInsertReturning = jest.fn();
const textNoteFirst = jest.fn();
const textNoteUpdateReturning = jest.fn();
const insertSpy = jest.fn();
const updateSpy = jest.fn();

jest.mock('../../config/database', () => {
  const dbFn: any = jest.fn((table: string) => {
    if (table === 'projects') {
      return {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        first: projectFirst,
      };
    }
    if (table === 'patterns') {
      return {
        where: jest.fn().mockReturnThis(),
        first: patternFirst,
      };
    }
    if (table === 'text_notes') {
      return {
        where: jest.fn().mockReturnThis(),
        first: textNoteFirst,
        insert: (payload: any) => {
          insertSpy(payload);
          return { returning: textNoteInsertReturning };
        },
        update: (payload: any) => {
          updateSpy(payload);
          return { returning: textNoteUpdateReturning };
        },
      };
    }
    return { where: jest.fn().mockReturnThis(), first: jest.fn() };
  });
  return { default: dbFn, __esModule: true };
});

jest.mock('../../middleware/auditLog', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../config/logger', () => ({
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
  __esModule: true,
}));

import { createTextNote, updateTextNote } from '../notesController';

function makeReq(body: any, params: any = {}): any {
  return { body, params, user: { userId: 'user-1' } };
}

function makeRes(): any {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('createTextNote — JSONB tags handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    projectFirst.mockResolvedValue({ id: 'proj-1', user_id: 'user-1' });
    patternFirst.mockResolvedValue(null);
    textNoteInsertReturning.mockResolvedValue([
      { id: 'note-1', project_id: 'proj-1', tags: ['audit', 'r5'] },
    ]);
  });

  it('JSON.stringify tags array before inserting into the jsonb column', async () => {
    const res = makeRes();
    await createTextNote(
      makeReq(
        { content: 'audited note', tags: ['audit', 'r5'] },
        { id: 'proj-1' },
      ),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(insertSpy).toHaveBeenCalledTimes(1);
    const payload = insertSpy.mock.calls[0][0];
    expect(payload.tags).toBe('["audit","r5"]');
  });

  it('writes null for tags when none are provided', async () => {
    const res = makeRes();
    await createTextNote(
      makeReq({ content: 'no tags here' }, { id: 'proj-1' }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(201);
    const payload = insertSpy.mock.calls[0][0];
    expect(payload.tags).toBeNull();
  });

  it('serialises an empty tags array to "[]" rather than a Postgres array literal', async () => {
    const res = makeRes();
    await createTextNote(
      makeReq({ content: 'empty tags', tags: [] }, { id: 'proj-1' }),
      res,
    );

    const payload = insertSpy.mock.calls[0][0];
    expect(payload.tags).toBe('[]');
  });
});

describe('updateTextNote — JSONB tags handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    projectFirst.mockResolvedValue({ id: 'proj-1', user_id: 'user-1' });
    patternFirst.mockResolvedValue(null);
    textNoteFirst.mockResolvedValue({
      id: 'note-1',
      project_id: 'proj-1',
      pattern_id: null,
    });
    textNoteUpdateReturning.mockResolvedValue([
      { id: 'note-1', project_id: 'proj-1', tags: ['x'] },
    ]);
  });

  it('JSON.stringify tags array on update', async () => {
    const res = makeRes();
    await updateTextNote(
      makeReq({ tags: ['x', 'y'] }, { id: 'proj-1', noteId: 'note-1' }),
      res,
    );

    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy.mock.calls[0][0].tags).toBe('["x","y"]');
  });

  it('serialises an empty tags array to "[]" on update, not a Postgres array literal', async () => {
    const res = makeRes();
    await updateTextNote(
      makeReq({ tags: [] }, { id: 'proj-1', noteId: 'note-1' }),
      res,
    );

    expect(updateSpy.mock.calls[0][0].tags).toBe('[]');
  });

  it('writes null when tags is explicitly nulled', async () => {
    const res = makeRes();
    await updateTextNote(
      makeReq({ tags: null }, { id: 'proj-1', noteId: 'note-1' }),
      res,
    );

    expect(updateSpy.mock.calls[0][0].tags).toBeNull();
  });

  it('does not touch tags field when not provided in update', async () => {
    const res = makeRes();
    await updateTextNote(
      makeReq({ title: 'renamed' }, { id: 'proj-1', noteId: 'note-1' }),
      res,
    );

    expect('tags' in updateSpy.mock.calls[0][0]).toBe(false);
  });
});
