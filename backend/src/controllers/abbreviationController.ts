import { Request, Response } from 'express';
import {
  Craft,
  categoryCounts,
  isCraft,
  listAbbreviations,
  lookupAbbreviation,
} from '../services/abbreviationService';
import { ValidationError } from '../utils/errorHandler';

const MAX_SEARCH_LEN = 100;
const MAX_CATEGORY_LEN = 32;

const parseCraft = (raw: unknown): Craft | undefined => {
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  if (!isCraft(raw)) {
    throw new ValidationError(
      'craft must be one of: knit, crochet, tunisian, loom-knit'
    );
  }
  return raw;
};

const parseCategory = (raw: unknown): string | undefined => {
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  if (raw.length > MAX_CATEGORY_LEN) {
    throw new ValidationError(`category must be ${MAX_CATEGORY_LEN} characters or fewer`);
  }
  return raw;
};

const parseSearch = (raw: unknown): string | undefined => {
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  if (raw.length > MAX_SEARCH_LEN) {
    throw new ValidationError(`search must be ${MAX_SEARCH_LEN} characters or fewer`);
  }
  return raw;
};

/**
 * GET /api/abbreviations
 * GET /shared/glossary
 *
 * Both auth and public routes share the same handler — the data is
 * uniform CYC reference content, no per-user secrets. Auth route includes
 * the user's custom rows (none yet, future-proofed); public route is
 * system-only.
 */
export const list = async (req: Request, res: Response) => {
  const craft = parseCraft(req.query.craft);
  const category = parseCategory(req.query.category);
  const search = parseSearch(req.query.search ?? req.query.q);

  const userId = req.user?.userId;

  const data = await listAbbreviations({ craft, category, search, userId });
  res.json({ success: true, data });
};

/**
 * GET /api/abbreviations/lookup?abbreviation=k2tog&craft=knit
 * GET /shared/glossary/lookup?abbreviation=k2tog&craft=knit
 *
 * Exact case-sensitive lookup. Returns 404 via NotFoundError when missing
 * so the chart-palette deep-link can degrade gracefully.
 */
export const lookup = async (req: Request, res: Response) => {
  const abbreviation = req.query.abbreviation;
  const craft = parseCraft(req.query.craft);

  if (typeof abbreviation !== 'string' || abbreviation.length === 0) {
    throw new ValidationError('abbreviation query parameter is required');
  }
  if (!craft) {
    throw new ValidationError('craft query parameter is required');
  }

  const row = await lookupAbbreviation(abbreviation, craft);
  if (!row) {
    res.status(404).json({ success: false, message: 'Abbreviation not found' });
    return;
  }
  res.json({ success: true, data: row });
};

/**
 * GET /api/abbreviations/categories?craft=knit
 * GET /shared/glossary/categories?craft=knit
 *
 * Aggregate count of system rows by category. Drives the filter-chip row
 * in the glossary UI ("Stitches (28)", "Decreases (8)", ...).
 */
export const categories = async (req: Request, res: Response) => {
  const craft = parseCraft(req.query.craft);
  const data = await categoryCounts(craft);
  res.json({ success: true, data });
};
