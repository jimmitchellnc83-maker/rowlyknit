/**
 * Chart Detection Service
 * Detects chart grids and symbols from uploaded images
 *
 * Note: Full implementation would require ML/computer vision libraries
 * This provides the structure and simplified detection logic
 */

import sharp from 'sharp';
import logger from '../config/logger';

export interface DetectedCell {
  symbol: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GridDetectionResult {
  rows: number;
  cols: number;
  cellWidth: number;
  cellHeight: number;
  gridBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface DetectedChart {
  grid: string[][];
  confidence: number;
  grid_dimensions: { rows: number; cols: number };
  unrecognized_symbols: Array<{ row: number; col: number }>;
  cell_confidences: Array<Array<number>>;
}

// Known symbols for template matching
const KNOWN_SYMBOLS = [
  'k', 'p', '.', '-', 'yo', 'o', 'k2tog', '/', 'ssk', '\\',
  'sl', 'v', 'm1l', 'm1r', 'kfb', 'c4f', 'c4b', 'x', '[]',
];

/**
 * Preprocess image for better detection
 */
export async function preprocessImage(
  imageBuffer: Buffer,
  contentType?: string
): Promise<{
  processed: Buffer;
  metadata: sharp.Metadata;
}> {
  // Some users upload PDFs instead of images; render first page at a high density
  const isPdf =
    contentType === 'application/pdf' || imageBuffer.subarray(0, 4).toString() === '%PDF';

  let pipeline = isPdf
    ? sharp(imageBuffer, { density: 300 }).png()
    : sharp(imageBuffer);

  // Get original metadata after normalizing format
  const metadata = await pipeline.metadata();

  // Preprocess: grayscale, normalize contrast, sharpen
  const processed = await pipeline
    .grayscale()
    .normalize() // Enhance contrast
    .sharpen() // Improve edge detection
    .toBuffer();

  return { processed, metadata };
}

export interface DetectGridOptions {
  /** When the caller knows the chart's intended shape (e.g. the
   *  knitter said "this is a 24-stitch by 40-row motif"), passing
   *  these skips the cell-size heuristic and aligns the grid
   *  directly. Single biggest accuracy win for known-dimension
   *  imports. */
  targetCols?: number;
  targetRows?: number;
}

/**
 * Detect grid structure in the image.
 *
 * Two paths:
 *   1. Caller knows the chart shape (targetCols/targetRows set) →
 *      partition the image into that exact grid. No estimation. This
 *      is the path users hit when they've imported a chart from a
 *      published pattern and already know its dimensions.
 *   2. Unknown shape → fall back to the cell-size heuristic
 *      (clamps cell size 20-50px, derives row/col counts).
 *
 * Production-quality grid detection (Hough lines, projection profiles)
 * needs OpenCV which we're intentionally avoiding for v1; the targetCols
 * path covers the most common workflow without adding deps.
 */
export async function detectGrid(
  imageBuffer: Buffer,
  options: DetectGridOptions = {},
): Promise<GridDetectionResult | null> {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    const { width = 0, height = 0 } = metadata;

    if (width === 0 || height === 0) {
      return null;
    }

    // Path 1: caller-supplied dimensions. Trust them, partition exactly.
    if (
      typeof options.targetCols === 'number' &&
      typeof options.targetRows === 'number' &&
      options.targetCols >= 1 &&
      options.targetRows >= 1
    ) {
      const cols = Math.min(200, Math.max(1, Math.round(options.targetCols)));
      const rows = Math.min(200, Math.max(1, Math.round(options.targetRows)));
      return {
        rows,
        cols,
        cellWidth: Math.max(1, Math.floor(width / cols)),
        cellHeight: Math.max(1, Math.floor(height / rows)),
        gridBounds: { x: 0, y: 0, width, height },
      };
    }

    // Path 2: heuristic estimation. Compute a Laplacian edge map up
    // front so future CV refinements have a foothold; not currently
    // consumed but kept for parity with the previous behavior.
    void (await sharp(imageBuffer)
      .grayscale()
      .convolve({
        width: 3,
        height: 3,
        kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1], // Laplacian edge detection
      })
      .raw()
      .toBuffer());

    // Estimate grid dimensions based on image size
    // Typical chart cells are 20-50 pixels
    const estimatedCellSize = Math.min(
      Math.max(20, Math.min(width, height) / 50),
      50,
    );

    const estimatedCols = Math.round(width / estimatedCellSize);
    const estimatedRows = Math.round(height / estimatedCellSize);

    // Limit to reasonable chart sizes
    const cols = Math.min(100, Math.max(5, estimatedCols));
    const rows = Math.min(200, Math.max(5, estimatedRows));

    return {
      rows,
      cols,
      cellWidth: Math.round(width / cols),
      cellHeight: Math.round(height / rows),
      gridBounds: {
        x: 0,
        y: 0,
        width,
        height,
      },
    };
  } catch (error) {
    logger.error('Grid detection error:', error);
    return null;
  }
}

/**
 * Extract a single cell from the image.
 *
 * `innerRatio` (0..1, default 0.7) shrinks the sampling box to the
 * center of the cell so that grid borders (which are usually rendered
 * as dark lines or shadows) don't bleed into the symbol classifier.
 * This is the cheapest accuracy win available without doing real
 * line detection — borders register as "dark pixels" in the same
 * statistics the recognizer reads, and inflate the dark-ratio of
 * every cell.
 */
export async function extractCell(
  imageBuffer: Buffer,
  row: number,
  col: number,
  cellWidth: number,
  cellHeight: number,
  innerRatio = 0.7,
): Promise<Buffer> {
  // Inner-region sampling. Clamp to 0.4-1.0 so the box is always
  // big enough to capture the symbol but never wider than the cell.
  const ratio = Math.min(1, Math.max(0.4, innerRatio));
  const innerW = Math.max(1, Math.floor(cellWidth * ratio));
  const innerH = Math.max(1, Math.floor(cellHeight * ratio));
  const offsetX = Math.floor((cellWidth - innerW) / 2);
  const offsetY = Math.floor((cellHeight - innerH) / 2);

  return sharp(imageBuffer)
    .extract({
      left: col * cellWidth + offsetX,
      top: row * cellHeight + offsetY,
      width: innerW,
      height: innerH,
    })
    .resize(32, 32) // Normalize size for comparison
    .toBuffer();
}

/**
 * Recognize symbol in a cell
 * In production: Use trained CNN or template matching with OpenCV
 */
export async function recognizeSymbol(
  cellBuffer: Buffer
): Promise<{ symbol: string; confidence: number }> {
  try {
    // Analyze cell for patterns
    const { data, info } = await sharp(cellBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = new Uint8Array(data);
    const totalPixels = info.width * info.height;

    // Calculate basic statistics
    let sum = 0;
    let darkPixels = 0;
    let lightPixels = 0;

    for (let i = 0; i < pixels.length; i++) {
      sum += pixels[i];
      if (pixels[i] < 100) darkPixels++;
      if (pixels[i] > 200) lightPixels++;
    }

    const avgBrightness = sum / pixels.length;
    const darkRatio = darkPixels / totalPixels;
    const lightRatio = lightPixels / totalPixels;

    // Simple pattern matching based on pixel distribution
    // In production: Use template matching or ML model

    // Mostly white/light = knit stitch
    if (lightRatio > 0.8) {
      return { symbol: 'k', confidence: 0.75 };
    }

    // Mostly dark = purl stitch (often shown as filled)
    if (darkRatio > 0.6) {
      return { symbol: 'p', confidence: 0.7 };
    }

    // Check for specific patterns
    // O-shape (yarn over) - light center, dark ring
    const centerBrightness = calculateCenterBrightness(pixels, info.width, info.height);
    if (centerBrightness > avgBrightness * 1.2 && darkRatio > 0.3 && darkRatio < 0.5) {
      return { symbol: 'yo', confidence: 0.65 };
    }

    // Diagonal patterns (decreases)
    const diagonalPattern = detectDiagonalPattern(pixels, info.width, info.height);
    if (diagonalPattern === 'right') {
      return { symbol: 'k2tog', confidence: 0.6 };
    }
    if (diagonalPattern === 'left') {
      return { symbol: 'ssk', confidence: 0.6 };
    }

    // X pattern (no stitch)
    if (hasXPattern(pixels, info.width, info.height)) {
      return { symbol: 'x', confidence: 0.65 };
    }

    // Default to knit with low confidence
    return { symbol: 'k', confidence: 0.4 };
  } catch (error) {
    logger.error('Symbol recognition error:', error);
    return { symbol: 'k', confidence: 0.3 };
  }
}

/**
 * Calculate brightness of center region
 */
function calculateCenterBrightness(
  pixels: Uint8Array,
  width: number,
  height: number
): number {
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const radius = Math.min(width, height) / 4;

  let sum = 0;
  let count = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      if (dx * dx + dy * dy <= radius * radius) {
        sum += pixels[y * width + x];
        count++;
      }
    }
  }

  return count > 0 ? sum / count : 128;
}

/**
 * Detect diagonal line patterns
 */
function detectDiagonalPattern(
  pixels: Uint8Array,
  width: number,
  height: number
): 'left' | 'right' | null {
  let leftDiagDark = 0;
  let rightDiagDark = 0;
  const diagWidth = Math.min(width, height);

  for (let i = 0; i < diagWidth; i++) {
    // Check main diagonal (top-left to bottom-right)
    const rightIdx = Math.floor((i / diagWidth) * height) * width + Math.floor((i / diagWidth) * width);
    if (rightIdx < pixels.length && pixels[rightIdx] < 100) {
      rightDiagDark++;
    }

    // Check anti-diagonal (top-right to bottom-left)
    const leftIdx = Math.floor((i / diagWidth) * height) * width + Math.floor(((diagWidth - i) / diagWidth) * width);
    if (leftIdx < pixels.length && pixels[leftIdx] < 100) {
      leftDiagDark++;
    }
  }

  const threshold = diagWidth * 0.4;
  if (rightDiagDark > threshold && rightDiagDark > leftDiagDark) {
    return 'right';
  }
  if (leftDiagDark > threshold && leftDiagDark > rightDiagDark) {
    return 'left';
  }

  return null;
}

/**
 * Detect X pattern (cross)
 */
function hasXPattern(pixels: Uint8Array, width: number, height: number): boolean {
  let bothDiagDark = 0;
  const diagWidth = Math.min(width, height);

  for (let i = 0; i < diagWidth; i++) {
    const rightIdx = Math.floor((i / diagWidth) * height) * width + Math.floor((i / diagWidth) * width);
    const leftIdx = Math.floor((i / diagWidth) * height) * width + Math.floor(((diagWidth - i) / diagWidth) * width);

    if (rightIdx < pixels.length && leftIdx < pixels.length) {
      if (pixels[rightIdx] < 100 && pixels[leftIdx] < 100) {
        bothDiagDark++;
      }
    }
  }

  return bothDiagDark > diagWidth * 0.3;
}

export interface DetectChartOptions extends DetectGridOptions {
  /** See extractCell — inner-region sampling ratio. */
  innerRatio?: number;
}

/**
 * Main detection function - process entire image.
 *
 * When `targetCols` / `targetRows` are passed (the user knows their
 * chart is e.g. 24×40), grid detection skips the heuristic and slices
 * the image into the requested grid directly. This is the path that
 * delivers the biggest accuracy win in v1.1 — without it, the sampled
 * cells often straddle the boundary between two real cells.
 */
export async function detectChartFromImage(
  imageBuffer: Buffer,
  contentType?: string,
  options: DetectChartOptions = {},
): Promise<DetectedChart> {
  // Preprocess image
  const { processed, metadata: _metadata } = await preprocessImage(imageBuffer, contentType);

  // Detect grid (with caller-supplied dims when present)
  const grid = await detectGrid(processed, {
    targetCols: options.targetCols,
    targetRows: options.targetRows,
  });

  if (!grid) {
    throw new Error('Could not detect grid structure in image');
  }

  // Extract and recognize each cell
  const symbols: string[][] = [];
  const cellConfidences: number[][] = [];
  const unrecognized: Array<{ row: number; col: number }> = [];

  let totalConfidence = 0;
  let cellCount = 0;

  for (let row = 0; row < grid.rows; row++) {
    const rowSymbols: string[] = [];
    const rowConfidences: number[] = [];

    for (let col = 0; col < grid.cols; col++) {
      try {
        const cellBuffer = await extractCell(
          processed,
          row,
          col,
          grid.cellWidth,
          grid.cellHeight,
          options.innerRatio,
        );

        const { symbol, confidence } = await recognizeSymbol(cellBuffer);

        rowSymbols.push(symbol);
        rowConfidences.push(confidence);
        totalConfidence += confidence;
        cellCount++;

        if (confidence < 0.5) {
          unrecognized.push({ row, col });
        }
      } catch (error) {
        rowSymbols.push('k'); // Default
        rowConfidences.push(0.3);
        unrecognized.push({ row, col });
        cellCount++;
      }
    }

    symbols.push(rowSymbols);
    cellConfidences.push(rowConfidences);
  }

  const overallConfidence = cellCount > 0 ? totalConfidence / cellCount : 0;

  return {
    grid: symbols,
    confidence: overallConfidence,
    grid_dimensions: { rows: grid.rows, cols: grid.cols },
    unrecognized_symbols: unrecognized,
    cell_confidences: cellConfidences,
  };
}

/**
 * Apply user corrections to a detected chart
 */
export function applyCorrections(
  grid: string[][],
  corrections: Array<{ row: number; col: number; corrected: string }>
): string[][] {
  const correctedGrid = grid.map((row) => [...row]);

  for (const correction of corrections) {
    if (
      correction.row >= 0 &&
      correction.row < correctedGrid.length &&
      correction.col >= 0 &&
      correction.col < (correctedGrid[correction.row]?.length || 0)
    ) {
      correctedGrid[correction.row][correction.col] = correction.corrected;
    }
  }

  return correctedGrid;
}

/**
 * Validate that a symbol is known
 */
export function isValidSymbol(symbol: string): boolean {
  return KNOWN_SYMBOLS.includes(symbol.toLowerCase());
}

export default {
  detectChartFromImage,
  preprocessImage,
  detectGrid,
  extractCell,
  recognizeSymbol,
  applyCorrections,
  isValidSymbol,
};
