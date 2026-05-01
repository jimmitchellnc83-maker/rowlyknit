/**
 * Regression tests for the empty-string-to-numeric 500 across pattern
 * enhancements (sections / bookmarks / highlights / annotations), found in
 * the platform audit 2026-04-30 (Critical #6). The page-number / position /
 * zoom / opacity inputs come from PDF-overlay forms and arrive as '' when
 * blank — Postgres rejected those when cast to integer / decimal.
 */

const sectionInsertSpy = jest.fn();
const sectionInsertReturning = jest.fn();
const sectionUpdateSpy = jest.fn();
const sectionUpdateReturning = jest.fn();
const sectionFirst = jest.fn();

const bookmarkInsertSpy = jest.fn();
const bookmarkInsertReturning = jest.fn();
const bookmarkUpdateSpy = jest.fn();
const bookmarkUpdateReturning = jest.fn();
const bookmarkFirst = jest.fn();

const highlightInsertSpy = jest.fn();
const highlightInsertReturning = jest.fn();
const highlightUpdateSpy = jest.fn();
const highlightUpdateReturning = jest.fn();
const highlightFirst = jest.fn();

const annotationInsertSpy = jest.fn();
const annotationInsertReturning = jest.fn();

const patternFirst = jest.fn();
const projectFirst = jest.fn();

jest.mock('../../config/database', () => {
  const dbFn: any = jest.fn((table: string) => {
    if (table === 'patterns') {
      return {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        first: patternFirst,
      };
    }
    if (table === 'projects') {
      return {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        first: projectFirst,
      };
    }
    if (table === 'pattern_sections') {
      return {
        where: jest.fn().mockReturnThis(),
        first: sectionFirst,
        insert: (payload: any) => {
          sectionInsertSpy(payload);
          return { returning: sectionInsertReturning };
        },
        update: (payload: any) => {
          sectionUpdateSpy(payload);
          return { returning: sectionUpdateReturning };
        },
      };
    }
    if (table === 'pattern_bookmarks') {
      return {
        where: jest.fn().mockReturnThis(),
        first: bookmarkFirst,
        insert: (payload: any) => {
          bookmarkInsertSpy(payload);
          return { returning: bookmarkInsertReturning };
        },
        update: (payload: any) => {
          bookmarkUpdateSpy(payload);
          return { returning: bookmarkUpdateReturning };
        },
      };
    }
    if (table === 'pattern_highlights') {
      return {
        where: jest.fn().mockReturnThis(),
        first: highlightFirst,
        insert: (payload: any) => {
          highlightInsertSpy(payload);
          return { returning: highlightInsertReturning };
        },
        update: (payload: any) => {
          highlightUpdateSpy(payload);
          return { returning: highlightUpdateReturning };
        },
      };
    }
    if (table === 'pattern_annotations') {
      return {
        where: jest.fn().mockReturnThis(),
        first: jest.fn(),
        insert: (payload: any) => {
          annotationInsertSpy(payload);
          return { returning: annotationInsertReturning };
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

import {
  createPatternSection,
  updatePatternSection,
  createPatternBookmark,
  updatePatternBookmark,
  createPatternHighlight,
  updatePatternHighlight,
  createPatternAnnotation,
} from '../patternEnhancementsController';

function makeReq(body: any, params: any = {}): any {
  return { body, params, user: { userId: 'user-1' } };
}

function makeRes(): any {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('createPatternSection — coercion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    patternFirst.mockResolvedValue({ id: 'pat-1', user_id: 'user-1' });
    sectionInsertReturning.mockResolvedValue([{ id: 'sec-1' }]);
  });

  it('coerces empty page_number / y_position / sort_order to null', async () => {
    const res = makeRes();
    await createPatternSection(
      makeReq(
        { name: 'Body', pageNumber: '', yPosition: '', sortOrder: '' },
        { patternId: 'pat-1' },
      ),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(201);
    const payload = sectionInsertSpy.mock.calls[0][0];
    expect(payload.page_number).toBeNull();
    expect(payload.y_position).toBeNull();
    expect(payload.sort_order).toBeNull();
  });

  it('parses numeric strings to integers', async () => {
    const res = makeRes();
    await createPatternSection(
      makeReq(
        { name: 'Body', pageNumber: '3', yPosition: '120', sortOrder: '2' },
        { patternId: 'pat-1' },
      ),
      res,
    );

    const payload = sectionInsertSpy.mock.calls[0][0];
    expect(payload.page_number).toBe(3);
    expect(payload.y_position).toBe(120);
    expect(payload.sort_order).toBe(2);
  });
});

describe('updatePatternSection — coercion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    patternFirst.mockResolvedValue({ id: 'pat-1', user_id: 'user-1' });
    sectionFirst.mockResolvedValue({ id: 'sec-1', pattern_id: 'pat-1' });
    sectionUpdateReturning.mockResolvedValue([{ id: 'sec-1' }]);
  });

  it('coerces empty fields to null', async () => {
    const res = makeRes();
    await updatePatternSection(
      makeReq(
        { pageNumber: '', yPosition: '', sortOrder: '' },
        { patternId: 'pat-1', sectionId: 'sec-1' },
      ),
      res,
    );

    const payload = sectionUpdateSpy.mock.calls[0][0];
    expect(payload.page_number).toBeNull();
    expect(payload.y_position).toBeNull();
    expect(payload.sort_order).toBeNull();
  });
});

describe('createPatternBookmark — coercion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    patternFirst.mockResolvedValue({ id: 'pat-1', user_id: 'user-1' });
    projectFirst.mockResolvedValue({ id: 'proj-1', user_id: 'user-1' });
    bookmarkInsertReturning.mockResolvedValue([{ id: 'bm-1' }]);
  });

  it('coerces empty page_number / y_position / zoom_level', async () => {
    const res = makeRes();
    await createPatternBookmark(
      makeReq(
        {
          name: 'Sleeve start',
          pageNumber: '',
          yPosition: '',
          zoomLevel: '',
        },
        { patternId: 'pat-1' },
      ),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(201);
    const payload = bookmarkInsertSpy.mock.calls[0][0];
    expect(payload.page_number).toBeNull();
    expect(payload.y_position).toBeNull();
    expect(payload.zoom_level).toBeNull();
  });

  it('parses page_number int + zoom_level decimal', async () => {
    const res = makeRes();
    await createPatternBookmark(
      makeReq(
        { name: 'Sleeve start', pageNumber: '5', zoomLevel: '1.25' },
        { patternId: 'pat-1' },
      ),
      res,
    );

    const payload = bookmarkInsertSpy.mock.calls[0][0];
    expect(payload.page_number).toBe(5);
    expect(payload.zoom_level).toBe(1.25);
  });
});

describe('updatePatternBookmark — coercion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    patternFirst.mockResolvedValue({ id: 'pat-1', user_id: 'user-1' });
    bookmarkFirst.mockResolvedValue({ id: 'bm-1', pattern_id: 'pat-1' });
    bookmarkUpdateReturning.mockResolvedValue([{ id: 'bm-1' }]);
  });

  it('coerces empty fields to null on update', async () => {
    const res = makeRes();
    await updatePatternBookmark(
      makeReq(
        { pageNumber: '', yPosition: '', zoomLevel: '' },
        { patternId: 'pat-1', bookmarkId: 'bm-1' },
      ),
      res,
    );

    const payload = bookmarkUpdateSpy.mock.calls[0][0];
    expect(payload.page_number).toBeNull();
    expect(payload.y_position).toBeNull();
    expect(payload.zoom_level).toBeNull();
  });
});

describe('createPatternHighlight — coercion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    patternFirst.mockResolvedValue({ id: 'pat-1', user_id: 'user-1' });
    highlightInsertReturning.mockResolvedValue([{ id: 'hl-1' }]);
  });

  it('preserves the 0.3 opacity default when blank', async () => {
    const res = makeRes();
    await createPatternHighlight(
      makeReq(
        {
          pageNumber: '4',
          coordinates: { x: 1, y: 1, width: 10, height: 10 },
          opacity: '',
        },
        { patternId: 'pat-1' },
      ),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(201);
    const payload = highlightInsertSpy.mock.calls[0][0];
    expect(payload.page_number).toBe(4);
    expect(payload.opacity).toBe(0.3);
  });

  it('parses opacity decimal when provided', async () => {
    const res = makeRes();
    await createPatternHighlight(
      makeReq(
        {
          pageNumber: '4',
          coordinates: { x: 1, y: 1, width: 10, height: 10 },
          opacity: '0.6',
        },
        { patternId: 'pat-1' },
      ),
      res,
    );

    const payload = highlightInsertSpy.mock.calls[0][0];
    expect(payload.opacity).toBe(0.6);
  });
});

describe('updatePatternHighlight — coercion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    patternFirst.mockResolvedValue({ id: 'pat-1', user_id: 'user-1' });
    highlightFirst.mockResolvedValue({ id: 'hl-1', pattern_id: 'pat-1' });
    highlightUpdateReturning.mockResolvedValue([{ id: 'hl-1' }]);
  });

  it('coerces empty opacity to null on update', async () => {
    const res = makeRes();
    await updatePatternHighlight(
      makeReq({ opacity: '' }, { patternId: 'pat-1', highlightId: 'hl-1' }),
      res,
    );

    const payload = highlightUpdateSpy.mock.calls[0][0];
    expect(payload.opacity).toBeNull();
  });
});

describe('createPatternAnnotation — coercion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    patternFirst.mockResolvedValue({ id: 'pat-1', user_id: 'user-1' });
    annotationInsertReturning.mockResolvedValue([{ id: 'ann-1' }]);
  });

  it('coerces empty pageNumber to null', async () => {
    const res = makeRes();
    await createPatternAnnotation(
      makeReq(
        { annotationType: 'drawing', pageNumber: '' },
        { patternId: 'pat-1' },
      ),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(annotationInsertSpy.mock.calls[0][0].page_number).toBeNull();
  });

  it('parses numeric pageNumber', async () => {
    const res = makeRes();
    await createPatternAnnotation(
      makeReq(
        { annotationType: 'drawing', pageNumber: '7' },
        { patternId: 'pat-1' },
      ),
      res,
    );

    expect(annotationInsertSpy.mock.calls[0][0].page_number).toBe(7);
  });
});
