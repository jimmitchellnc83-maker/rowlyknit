import { Request, Response } from 'express';
import ravelryService, { RavelryNotConfiguredError, RavelryOAuthRequiredError } from '../services/ravelryService';
import { importStashPage as importStashPageService } from '../services/stashImportService';
import { importProjectsPage as importProjectsPageService } from '../services/projectImportService';
import { importFavoriteYarnsPage as importFavoriteYarnsPageService } from '../services/favoriteYarnsImportService';

function handleRavelryError(error: unknown, res: Response) {
  if (error instanceof RavelryNotConfiguredError) {
    return res.status(503).json({
      success: false,
      message: 'Ravelry integration is not configured.',
      code: 'RAVELRY_NOT_CONFIGURED',
    });
  }
  if (error instanceof RavelryOAuthRequiredError) {
    return res.status(403).json({
      success: false,
      message: error.message,
      code: 'RAVELRY_OAUTH_REQUIRED',
    });
  }
  throw error;
}

export async function searchYarns(req: Request, res: Response) {
  const { query, page, page_size, weight, fiberContent } = req.query;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Search query is required',
    });
  }

  try {
    const result = await ravelryService.searchYarns(
      query,
      page ? Number(page) : 1,
      page_size ? Number(page_size) : 20,
      {
        weight: weight as string | undefined,
        fiberContent: fiberContent as string | undefined,
      },
      req.user!.userId
    );

    if (!result) {
      return res.status(502).json({
        success: false,
        message: 'Failed to search Ravelry yarns. Please try again later.',
      });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    return handleRavelryError(error, res);
  }
}

export async function getYarn(req: Request, res: Response) {
  const id = Number(req.params.id);

  if (isNaN(id) || id <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Valid yarn ID is required',
    });
  }

  try {
    const yarn = await ravelryService.getYarn(id, req.user!.userId);

    if (!yarn) {
      return res.status(404).json({
        success: false,
        message: 'Yarn not found on Ravelry',
      });
    }

    res.json({ success: true, data: { yarn } });
  } catch (error) {
    return handleRavelryError(error, res);
  }
}

export async function searchPatterns(req: Request, res: Response) {
  const { query, page, page_size, craft, difficulty, weight } = req.query;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Search query is required',
    });
  }

  try {
    const result = await ravelryService.searchPatterns(
      query,
      page ? Number(page) : 1,
      page_size ? Number(page_size) : 20,
      {
        craft: craft as string | undefined,
        difficulty: difficulty as string | undefined,
        weight: weight as string | undefined,
      },
      req.user!.userId
    );

    if (!result) {
      return res.status(502).json({
        success: false,
        message: 'Failed to search Ravelry patterns. Please try again later.',
      });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    return handleRavelryError(error, res);
  }
}

export async function getPattern(req: Request, res: Response) {
  const id = Number(req.params.id);

  if (isNaN(id) || id <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Valid pattern ID is required',
    });
  }

  try {
    const pattern = await ravelryService.getPattern(id, req.user!.userId);

    if (!pattern) {
      return res.status(404).json({
        success: false,
        message: 'Pattern not found on Ravelry',
      });
    }

    res.json({ success: true, data: { pattern } });
  } catch (error) {
    return handleRavelryError(error, res);
  }
}

export async function getFavorites(req: Request, res: Response) {
  const { page, page_size } = req.query;

  try {
    const result = await ravelryService.getFavorites(
      req.user!.userId,
      page ? Number(page) : 1,
      page_size ? Number(page_size) : 50
    );

    if (!result) {
      return res.status(502).json({
        success: false,
        message: 'Failed to fetch Ravelry favorites. Please try again later.',
      });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    return handleRavelryError(error, res);
  }
}

/**
 * Import one page of the authenticated user's Ravelry stash into their yarn
 * table. Frontend is expected to call this endpoint in a loop, paging until
 * `pagination.page >= pagination.totalPages`, showing a progress UI.
 * Idempotent: already-imported entries are skipped, not overwritten.
 */
export async function importStashPage(req: Request, res: Response) {
  const page = req.query.page ? Number(req.query.page) : 1;
  const pageSize = req.query.page_size ? Number(req.query.page_size) : 50;

  if (!Number.isFinite(page) || page < 1) {
    return res.status(400).json({ success: false, message: 'Invalid page number' });
  }
  if (!Number.isFinite(pageSize) || pageSize < 1 || pageSize > 100) {
    return res.status(400).json({ success: false, message: 'page_size must be 1–100' });
  }

  try {
    const result = await importStashPageService(req.user!.userId, page, pageSize);
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof RavelryOAuthRequiredError || error instanceof RavelryNotConfiguredError) {
      return handleRavelryError(error, res);
    }
    return res.status(502).json({
      success: false,
      message: 'Failed to import stash page. Please try again.',
    });
  }
}

/**
 * Import one page of the authenticated user's Ravelry projects. Same
 * contract as stash import — client-driven pagination, idempotent skip-
 * existing. See stashImportService for shape.
 */
export async function importProjectsPage(req: Request, res: Response) {
  const page = req.query.page ? Number(req.query.page) : 1;
  const pageSize = req.query.page_size ? Number(req.query.page_size) : 50;

  if (!Number.isFinite(page) || page < 1) {
    return res.status(400).json({ success: false, message: 'Invalid page number' });
  }
  if (!Number.isFinite(pageSize) || pageSize < 1 || pageSize > 100) {
    return res.status(400).json({ success: false, message: 'page_size must be 1–100' });
  }

  try {
    const result = await importProjectsPageService(req.user!.userId, page, pageSize);
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof RavelryOAuthRequiredError || error instanceof RavelryNotConfiguredError) {
      return handleRavelryError(error, res);
    }
    return res.status(502).json({
      success: false,
      message: 'Failed to import projects page. Please try again.',
    });
  }
}

/**
 * Import one page of the authenticated user's Ravelry favorited yarns into
 * their yarn table as wishlist rows (`is_favorite = true`, `is_stash = false`).
 * Same client-driven pagination contract as stash / projects import.
 */
export async function importFavoriteYarnsPage(req: Request, res: Response) {
  const page = req.query.page ? Number(req.query.page) : 1;
  const pageSize = req.query.page_size ? Number(req.query.page_size) : 50;

  if (!Number.isFinite(page) || page < 1) {
    return res.status(400).json({ success: false, message: 'Invalid page number' });
  }
  if (!Number.isFinite(pageSize) || pageSize < 1 || pageSize > 100) {
    return res.status(400).json({ success: false, message: 'page_size must be 1–100' });
  }

  try {
    const result = await importFavoriteYarnsPageService(req.user!.userId, page, pageSize);
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof RavelryOAuthRequiredError || error instanceof RavelryNotConfiguredError) {
      return handleRavelryError(error, res);
    }
    return res.status(502).json({
      success: false,
      message: 'Failed to import favorite yarns page. Please try again.',
    });
  }
}

export async function getYarnWeights(req: Request, res: Response) {
  try {
    const weights = await ravelryService.getYarnWeights();

    if (!weights) {
      return res.status(502).json({
        success: false,
        message: 'Failed to fetch yarn weights from Ravelry',
      });
    }

    res.json({ success: true, data: { yarnWeights: weights } });
  } catch (error) {
    return handleRavelryError(error, res);
  }
}

export async function getColorFamilies(req: Request, res: Response) {
  try {
    const families = await ravelryService.getColorFamilies();

    if (!families) {
      return res.status(502).json({
        success: false,
        message: 'Failed to fetch color families from Ravelry',
      });
    }

    res.json({ success: true, data: { colorFamilies: families } });
  } catch (error) {
    return handleRavelryError(error, res);
  }
}
