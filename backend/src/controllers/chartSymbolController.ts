import { Request, Response } from 'express';
import { UnauthorizedError, ValidationError } from '../utils/errorHandler';
import {
  Craft,
  Technique,
  createCustomSymbol,
  deleteCustomSymbol,
  listSymbols,
  lookupSymbols,
  updateCustomSymbol,
} from '../services/chartSymbolService';

const isCraft = (value: unknown): value is Craft => value === 'knit' || value === 'crochet';

const VALID_TECHNIQUES: Technique[] = [
  'standard',
  'lace',
  'cables',
  'colorwork',
  'tapestry',
  'filet',
  'tunisian',
];

const isTechnique = (value: unknown): value is Technique =>
  typeof value === 'string' && VALID_TECHNIQUES.includes(value as Technique);

const requireUserId = (req: Request): string => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError();
  }
  return userId;
};

/**
 * GET /api/charts/symbols?craft=knit&technique=lace
 *
 * Both filters are optional. `technique` filters system symbols only —
 * custom symbols always appear regardless of technique.
 */
export const getPalette = async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const craftRaw = req.query.craft;
  const craft = typeof craftRaw === 'string' && isCraft(craftRaw) ? craftRaw : undefined;
  const techniqueRaw = req.query.technique;
  const technique =
    typeof techniqueRaw === 'string' && isTechnique(techniqueRaw) ? techniqueRaw : undefined;

  const palette = await listSymbols(userId, { craft, technique });
  res.json({ success: true, data: palette });
};

/**
 * GET /api/charts/symbols/lookup?symbols=k,p,k2tog
 */
export const getLookup = async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const symbolsRaw = req.query.symbols;

  if (typeof symbolsRaw !== 'string' || symbolsRaw.length === 0) {
    throw new ValidationError('symbols query parameter is required (comma-separated)');
  }

  const symbols = symbolsRaw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const data = await lookupSymbols(userId, symbols);
  res.json({ success: true, data });
};

/**
 * POST /api/charts/symbols
 */
export const postSymbol = async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const created = await createCustomSymbol(userId, req.body);
  res.status(201).json({ success: true, data: created });
};

/**
 * PUT /api/charts/symbols/:id
 */
export const putSymbol = async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const updated = await updateCustomSymbol(req.params.id, userId, req.body);
  res.json({ success: true, data: updated });
};

/**
 * DELETE /api/charts/symbols/:id
 */
export const deleteSymbol = async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  await deleteCustomSymbol(req.params.id, userId);
  res.json({ success: true });
};
