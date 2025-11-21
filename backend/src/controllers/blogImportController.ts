import { Request, Response } from 'express';
import blogExtractorService from '../services/blogExtractorService';
import logger from '../config/logger';

/**
 * Extract pattern content from a blog URL
 * POST /api/patterns/import-from-url
 */
export async function extractFromUrl(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { url } = req.body;

  try {
    // Extract content from URL
    const result = await blogExtractorService.extractFromUrl(userId, url);

    if (!result.success) {
      res.status(400).json({
        error: 'Failed to extract content',
        message: result.error,
        importId: result.importId,
      });
      return;
    }

    // Parse the extracted content to identify pattern sections
    const parsedData = blogExtractorService.parsePatternContent(result.extracted!.textContent);

    res.status(200).json({
      success: true,
      importId: result.importId,
      sourceUrl: result.sourceUrl,
      extracted: {
        title: result.extracted!.title,
        excerpt: result.extracted!.excerpt,
        byline: result.extracted!.byline,
        siteName: result.extracted!.siteName,
        content: result.extracted!.content,
        textContent: result.extracted!.textContent,
      },
      parsed: parsedData,
      metadata: result.metadata,
    });
  } catch (error) {
    logger.error('Error in extractFromUrl controller', {
      userId,
      url,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process the URL',
    });
  }
}

/**
 * Save an imported pattern from extracted content
 * POST /api/patterns/save-imported
 */
export async function saveImportedPattern(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { importId, patternData, sourceUrl } = req.body;

  try {
    // Verify the import belongs to this user
    const importRecord = await blogExtractorService.getImport(importId, userId);
    if (!importRecord) {
      res.status(404).json({
        error: 'Import not found',
        message: 'The specified import record was not found or does not belong to you',
      });
      return;
    }

    // Check if already saved
    if (importRecord.status === 'saved' && importRecord.pattern_id) {
      res.status(400).json({
        error: 'Already saved',
        message: 'This import has already been saved as a pattern',
        patternId: importRecord.pattern_id,
      });
      return;
    }

    // Save the pattern
    const patternId = await blogExtractorService.savePattern(
      userId,
      importId,
      patternData,
      sourceUrl || importRecord.source_url
    );

    res.status(201).json({
      success: true,
      patternId,
      message: 'Pattern imported successfully',
    });
  } catch (error) {
    logger.error('Error in saveImportedPattern controller', {
      userId,
      importId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to save the imported pattern',
    });
  }
}

/**
 * Get import history for the user
 * GET /api/patterns/imports
 */
export async function getImportHistory(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const limit = parseInt(req.query.limit as string, 10) || 20;

  try {
    const imports = await blogExtractorService.getImportHistory(userId, limit);

    res.status(200).json({
      success: true,
      imports,
      count: imports.length,
    });
  } catch (error) {
    logger.error('Error in getImportHistory controller', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch import history',
    });
  }
}

/**
 * Get a specific import record
 * GET /api/patterns/imports/:importId
 */
export async function getImport(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { importId } = req.params;

  try {
    const importRecord = await blogExtractorService.getImport(importId, userId);

    if (!importRecord) {
      res.status(404).json({
        error: 'Import not found',
        message: 'The specified import record was not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      import: importRecord,
    });
  } catch (error) {
    logger.error('Error in getImport controller', {
      userId,
      importId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch import record',
    });
  }
}
