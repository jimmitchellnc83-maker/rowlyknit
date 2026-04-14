import { Request, Response } from 'express';
import ravelryService from '../services/ravelryService';

export async function searchYarns(req: Request, res: Response) {
  const { query, page, page_size, weight, fiberContent } = req.query;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Search query is required',
    });
  }

  const result = await ravelryService.searchYarns(
    query,
    page ? Number(page) : 1,
    page_size ? Number(page_size) : 20,
    {
      weight: weight as string | undefined,
      fiberContent: fiberContent as string | undefined,
    }
  );

  if (!result) {
    return res.status(502).json({
      success: false,
      message: 'Failed to search Ravelry yarns. Please try again later.',
    });
  }

  res.json({
    success: true,
    data: result,
  });
}

export async function getYarn(req: Request, res: Response) {
  const id = Number(req.params.id);

  if (isNaN(id) || id <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Valid yarn ID is required',
    });
  }

  const yarn = await ravelryService.getYarn(id);

  if (!yarn) {
    return res.status(404).json({
      success: false,
      message: 'Yarn not found on Ravelry',
    });
  }

  res.json({
    success: true,
    data: { yarn },
  });
}

export async function searchPatterns(req: Request, res: Response) {
  const { query, page, page_size, craft, difficulty, weight } = req.query;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Search query is required',
    });
  }

  const result = await ravelryService.searchPatterns(
    query,
    page ? Number(page) : 1,
    page_size ? Number(page_size) : 20,
    {
      craft: craft as string | undefined,
      difficulty: difficulty as string | undefined,
      weight: weight as string | undefined,
    }
  );

  if (!result) {
    return res.status(502).json({
      success: false,
      message: 'Failed to search Ravelry patterns. Please try again later.',
    });
  }

  res.json({
    success: true,
    data: result,
  });
}

export async function getPattern(req: Request, res: Response) {
  const id = Number(req.params.id);

  if (isNaN(id) || id <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Valid pattern ID is required',
    });
  }

  const pattern = await ravelryService.getPattern(id);

  if (!pattern) {
    return res.status(404).json({
      success: false,
      message: 'Pattern not found on Ravelry',
    });
  }

  res.json({
    success: true,
    data: { pattern },
  });
}

export async function getYarnWeights(req: Request, res: Response) {
  const weights = await ravelryService.getYarnWeights();

  if (!weights) {
    return res.status(502).json({
      success: false,
      message: 'Failed to fetch yarn weights from Ravelry',
    });
  }

  res.json({
    success: true,
    data: { yarnWeights: weights },
  });
}

export async function getColorFamilies(req: Request, res: Response) {
  const families = await ravelryService.getColorFamilies();

  if (!families) {
    return res.status(502).json({
      success: false,
      message: 'Failed to fetch color families from Ravelry',
    });
  }

  res.json({
    success: true,
    data: { colorFamilies: families },
  });
}
