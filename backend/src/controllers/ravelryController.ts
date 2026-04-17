import { Request, Response } from 'express';
import ravelryService, { RavelryNotConfiguredError, RavelryOAuthRequiredError } from '../services/ravelryService';

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
