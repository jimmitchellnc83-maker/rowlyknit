/**
 * Auth + Launch Polish Sprint 2026-05-04 — PUT /api/projects/:id hardening.
 *
 * Live smoke after PR #381 surfaced two issues:
 *   1. `name: ''` was being persisted, blanking the project title.
 *   2. `recipient_id: '<some-uuid>'` was being silently accepted and
 *      dropped on the floor (the projects table has no such column).
 *
 * The controller now whitelists allowed body keys, rejects unknown
 * keys (including `recipient_id` / `recipientId`), trims `name` and
 * rejects empty/whitespace, and pins `status` + `projectType` to their
 * enums. These tests lock those contracts.
 */

import type { Request, Response } from 'express';

const projectsBuilder: any = {
  where: jest.fn().mockReturnThis(),
  whereNull: jest.fn().mockReturnThis(),
  first: jest.fn(),
  update: jest.fn().mockReturnThis(),
  returning: jest.fn(),
};

jest.mock('../../config/database', () => {
  const dbFn: any = jest.fn((table: string) => {
    if (table === 'projects') return projectsBuilder;
    return {
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([]),
    };
  });
  return { default: dbFn, __esModule: true };
});

jest.mock('../../middleware/auditLog', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

import { updateProject } from '../projectsController';
import { ValidationError } from '../../utils/errorHandler';

function buildReq(overrides: Partial<Request> = {}): Request {
  return {
    params: { id: 'project-1' },
    user: { userId: 'user-1' },
    body: {},
    ...overrides,
  } as unknown as Request;
}

function buildRes(): Response & { body?: any; statusCode?: number } {
  const res: any = {};
  res.statusCode = 200;
  res.json = jest.fn((b: any) => {
    res.body = b;
    return res;
  });
  res.status = jest.fn((c: number) => {
    res.statusCode = c;
    return res;
  });
  return res as Response & { body?: any; statusCode?: number };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: project exists and belongs to the requesting user.
  projectsBuilder.first.mockResolvedValue({
    id: 'project-1',
    user_id: 'user-1',
    name: 'Old name',
    status: 'active',
    deleted_at: null,
  });
  projectsBuilder.returning.mockResolvedValue([
    { id: 'project-1', name: 'New name', status: 'active' },
  ]);
});

describe('updateProject — name hardening', () => {
  it('rejects empty name with ValidationError (cannot blank the project title)', async () => {
    const req = buildReq({ body: { name: '' } });
    const res = buildRes();
    await expect(updateProject(req, res)).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects whitespace-only name', async () => {
    const req = buildReq({ body: { name: '   ' } });
    const res = buildRes();
    await expect(updateProject(req, res)).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects non-string name', async () => {
    const req = buildReq({ body: { name: 123 as any } });
    const res = buildRes();
    await expect(updateProject(req, res)).rejects.toBeInstanceOf(ValidationError);
  });

  it('trims a valid name before persisting', async () => {
    const req = buildReq({ body: { name: '  Sweater Plan  ' } });
    const res = buildRes();
    await updateProject(req, res);
    // The first call to .where/.update flow ends with .returning() — what
    // matters is that the trimmed name made it into the update payload.
    const updateCall = projectsBuilder.update.mock.calls[0][0];
    expect(updateCall.name).toBe('Sweater Plan');
  });

  it('omits name from the update when the field is not sent', async () => {
    const req = buildReq({ body: {} });
    const res = buildRes();
    await updateProject(req, res);
    const updateCall = projectsBuilder.update.mock.calls[0][0];
    expect(updateCall).not.toHaveProperty('name');
  });
});

describe('updateProject — projectType / status enums', () => {
  it('rejects status not in the allowed set', async () => {
    const req = buildReq({ body: { status: 'pending' } });
    const res = buildRes();
    await expect(updateProject(req, res)).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects projectType not in the allowed set', async () => {
    const req = buildReq({ body: { projectType: 'spaceship' } });
    const res = buildRes();
    await expect(updateProject(req, res)).rejects.toBeInstanceOf(ValidationError);
  });

  it('accepts every documented status', async () => {
    for (const status of ['planned', 'active', 'paused', 'completed', 'archived']) {
      jest.clearAllMocks();
      projectsBuilder.first.mockResolvedValue({
        id: 'project-1',
        user_id: 'user-1',
        deleted_at: null,
      });
      projectsBuilder.returning.mockResolvedValue([{ id: 'project-1', status }]);
      const req = buildReq({ body: { status } });
      const res = buildRes();
      await expect(updateProject(req, res)).resolves.toBeUndefined();
    }
  });

  it('accepts every documented project type', async () => {
    for (const projectType of [
      'sweater',
      'cardigan',
      'hat',
      'scarf',
      'cowl',
      'shawl',
      'shawlette',
      'socks',
      'mittens',
      'blanket',
      'baby',
      'toy',
      'bag',
      'home',
      'dishcloth',
      'other',
    ]) {
      jest.clearAllMocks();
      projectsBuilder.first.mockResolvedValue({
        id: 'project-1',
        user_id: 'user-1',
        deleted_at: null,
      });
      projectsBuilder.returning.mockResolvedValue([
        { id: 'project-1', project_type: projectType },
      ]);
      const req = buildReq({ body: { projectType } });
      const res = buildRes();
      await expect(updateProject(req, res)).resolves.toBeUndefined();
    }
  });

  it('treats empty-string status / projectType as omitted (defensive — frontend sometimes sends "")', async () => {
    const req = buildReq({ body: { status: '', projectType: '' } });
    const res = buildRes();
    await updateProject(req, res);
    const updateCall = projectsBuilder.update.mock.calls[0][0];
    expect(updateCall).not.toHaveProperty('status');
    expect(updateCall).not.toHaveProperty('project_type');
  });
});

describe('updateProject — unknown body keys', () => {
  it('rejects recipient_id (the projects table has no such column)', async () => {
    const req = buildReq({
      body: { name: 'Still valid', recipient_id: 'a1b2c3d4-...' },
    });
    const res = buildRes();
    await expect(updateProject(req, res)).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects recipientId (camelCase variant — frontend modal historically sent this)', async () => {
    const req = buildReq({
      body: { name: 'Still valid', recipientId: 'a1b2c3d4-...' },
    });
    const res = buildRes();
    await expect(updateProject(req, res)).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects any other unknown field', async () => {
    const req = buildReq({ body: { hax: 'pwn' } });
    const res = buildRes();
    await expect(updateProject(req, res)).rejects.toBeInstanceOf(ValidationError);
  });

  it('happy path: all known fields go through', async () => {
    const req = buildReq({
      body: {
        name: 'OK',
        description: 'Some desc',
        projectType: 'sweater',
        status: 'active',
        notes: 'Notes',
        metadata: { foo: 'bar' },
        tags: ['tag-a'],
        isFavorite: true,
        startDate: '2026-01-01',
        targetCompletionDate: '2026-02-01',
        completedDate: null,
      },
    });
    const res = buildRes();
    await expect(updateProject(req, res)).resolves.toBeUndefined();
    const updateCall = projectsBuilder.update.mock.calls[0][0];
    expect(updateCall.name).toBe('OK');
    expect(updateCall.project_type).toBe('sweater');
    expect(updateCall.status).toBe('active');
    expect(updateCall.is_favorite).toBe(true);
  });
});
