/**
 * HTTP layer for the canonical Pattern model — PR 5 of the Designer
 * rebuild. Sits on top of `patternService.ts` (PR #264).
 *
 * Routes mounted at `/api/pattern-models/*`. Authenticated, user-scoped.
 *
 * The controller surface is deliberately thin — all real logic lives in
 * the service. The validators here exist to give 400s before the
 * service throws, which improves error messages and audit logs.
 */

import { Request, Response } from 'express';
import { NotFoundError, UnauthorizedError, ValidationError } from '../utils/errorHandler';
import {
  CreatePatternInput,
  UpdatePatternInput,
  createPattern,
  getPattern,
  listPatterns,
  softDeletePattern,
  updatePattern,
} from '../services/patternService';

const requireUserId = (req: Request): string => {
  const userId = req.user?.userId;
  if (!userId) throw new UnauthorizedError();
  return userId;
};

/**
 * GET /api/pattern-models
 * Optional ?limit, ?offset, ?includeDeleted=true
 */
export const list = async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const limit = req.query.limit ? Math.min(Number(req.query.limit), 200) : undefined;
  const offset = req.query.offset ? Math.max(0, Number(req.query.offset)) : undefined;
  const includeDeleted = req.query.includeDeleted === 'true';

  const patterns = await listPatterns(userId, { limit, offset, includeDeleted });
  res.json({ success: true, data: patterns });
};

/**
 * GET /api/pattern-models/:id
 */
export const getOne = async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const pattern = await getPattern(req.params.id, userId);
  if (!pattern) throw new NotFoundError('Pattern not found');
  res.json({ success: true, data: pattern });
};

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const validateCreateBody = (body: unknown): CreatePatternInput => {
  if (!isPlainObject(body)) throw new ValidationError('Body must be a JSON object');
  const { name, craft } = body as { name?: unknown; craft?: unknown };
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new ValidationError('name is required');
  }
  if (craft !== 'knit' && craft !== 'crochet') {
    throw new ValidationError('craft must be "knit" or "crochet"');
  }
  // The service does deeper validation on the optional fields.
  return body as unknown as CreatePatternInput;
};

const validateUpdateBody = (body: unknown): UpdatePatternInput => {
  if (!isPlainObject(body)) throw new ValidationError('Body must be a JSON object');
  const { name, craft, technique } = body as {
    name?: unknown;
    craft?: unknown;
    technique?: unknown;
  };
  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    throw new ValidationError('name, when present, must be a non-empty string');
  }
  if (craft !== undefined && craft !== 'knit' && craft !== 'crochet') {
    throw new ValidationError('craft, when present, must be "knit" or "crochet"');
  }
  if (
    technique !== undefined &&
    !['standard', 'lace', 'cables', 'colorwork', 'tapestry', 'filet', 'tunisian'].includes(
      technique as string,
    )
  ) {
    throw new ValidationError('technique value is not recognized');
  }
  return body as unknown as UpdatePatternInput;
};

/**
 * POST /api/pattern-models
 */
export const create = async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const input = validateCreateBody(req.body);
  const created = await createPattern(userId, input);
  res.status(201).json({ success: true, data: created });
};

/**
 * PUT /api/pattern-models/:id
 */
export const update = async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const patch = validateUpdateBody(req.body);
  const updated = await updatePattern(req.params.id, userId, patch);
  res.json({ success: true, data: updated });
};

/**
 * DELETE /api/pattern-models/:id (soft-delete)
 */
export const remove = async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  await softDeletePattern(req.params.id, userId);
  res.json({ success: true });
};
