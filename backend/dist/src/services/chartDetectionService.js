"use strict";
/**
 * Chart Detection Service
 * Detects chart grids and symbols from uploaded images
 *
 * Note: Full implementation would require ML/computer vision libraries
 * This provides the structure and simplified detection logic
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.preprocessImage = preprocessImage;
exports.detectGrid = detectGrid;
exports.extractCell = extractCell;
exports.recognizeSymbol = recognizeSymbol;
exports.detectChartFromImage = detectChartFromImage;
exports.applyCorrections = applyCorrections;
exports.isValidSymbol = isValidSymbol;
exports.getSymbolLibrary = getSymbolLibrary;
const sharp_1 = __importDefault(require("sharp"));
const database_1 = __importDefault(require("../config/database"));
// Known symbols for template matching
const KNOWN_SYMBOLS = [
    'k', 'p', '.', '-', 'yo', 'o', 'k2tog', '/', 'ssk', '\\',
    'sl', 'v', 'm1l', 'm1r', 'kfb', 'c4f', 'c4b', 'x', '[]',
];
/**
 * Preprocess image for better detection
 */
async function preprocessImage(imageBuffer) {
    // Get original metadata
    const metadata = await (0, sharp_1.default)(imageBuffer).metadata();
    // Preprocess: grayscale, normalize contrast, sharpen
    const processed = await (0, sharp_1.default)(imageBuffer)
        .grayscale()
        .normalize() // Enhance contrast
        .sharpen() // Improve edge detection
        .toBuffer();
    return { processed, metadata };
}
/**
 * Detect grid structure in the image
 * In production, this would use OpenCV Hough Line Transform
 */
async function detectGrid(imageBuffer) {
    try {
        const metadata = await (0, sharp_1.default)(imageBuffer).metadata();
        const { width = 0, height = 0 } = metadata;
        if (width === 0 || height === 0) {
            return null;
        }
        // Simplified grid detection based on image analysis
        // In production: Use OpenCV for line detection
        // Analyze image for grid patterns using edge detection
        const edgeBuffer = await (0, sharp_1.default)(imageBuffer)
            .grayscale()
            .convolve({
            width: 3,
            height: 3,
            kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1], // Laplacian edge detection
        })
            .raw()
            .toBuffer();
        // Estimate grid dimensions based on image size
        // Typical chart cells are 20-50 pixels
        const estimatedCellSize = Math.min(Math.max(20, Math.min(width, height) / 50), 50);
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
    }
    catch (error) {
        console.error('Grid detection error:', error);
        return null;
    }
}
/**
 * Extract a single cell from the image
 */
async function extractCell(imageBuffer, row, col, cellWidth, cellHeight) {
    return (0, sharp_1.default)(imageBuffer)
        .extract({
        left: col * cellWidth,
        top: row * cellHeight,
        width: cellWidth,
        height: cellHeight,
    })
        .resize(32, 32) // Normalize size for comparison
        .toBuffer();
}
/**
 * Recognize symbol in a cell
 * In production: Use trained CNN or template matching with OpenCV
 */
async function recognizeSymbol(cellBuffer) {
    try {
        // Analyze cell for patterns
        const { data, info } = await (0, sharp_1.default)(cellBuffer)
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
            if (pixels[i] < 100)
                darkPixels++;
            if (pixels[i] > 200)
                lightPixels++;
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
    }
    catch (error) {
        console.error('Symbol recognition error:', error);
        return { symbol: 'k', confidence: 0.3 };
    }
}
/**
 * Calculate brightness of center region
 */
function calculateCenterBrightness(pixels, width, height) {
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
function detectDiagonalPattern(pixels, width, height) {
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
function hasXPattern(pixels, width, height) {
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
/**
 * Main detection function - process entire image
 */
async function detectChartFromImage(imageBuffer) {
    // Preprocess image
    const { processed, metadata } = await preprocessImage(imageBuffer);
    // Detect grid
    const grid = await detectGrid(processed);
    if (!grid) {
        throw new Error('Could not detect grid structure in image');
    }
    // Extract and recognize each cell
    const symbols = [];
    const cellConfidences = [];
    const unrecognized = [];
    let totalConfidence = 0;
    let cellCount = 0;
    for (let row = 0; row < grid.rows; row++) {
        const rowSymbols = [];
        const rowConfidences = [];
        for (let col = 0; col < grid.cols; col++) {
            try {
                const cellBuffer = await extractCell(processed, row, col, grid.cellWidth, grid.cellHeight);
                const { symbol, confidence } = await recognizeSymbol(cellBuffer);
                rowSymbols.push(symbol);
                rowConfidences.push(confidence);
                totalConfidence += confidence;
                cellCount++;
                if (confidence < 0.5) {
                    unrecognized.push({ row, col });
                }
            }
            catch (error) {
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
function applyCorrections(grid, corrections) {
    const correctedGrid = grid.map((row) => [...row]);
    for (const correction of corrections) {
        if (correction.row >= 0 &&
            correction.row < correctedGrid.length &&
            correction.col >= 0 &&
            correction.col < (correctedGrid[correction.row]?.length || 0)) {
            correctedGrid[correction.row][correction.col] = correction.corrected;
        }
    }
    return correctedGrid;
}
/**
 * Validate that a symbol is known
 */
function isValidSymbol(symbol) {
    return KNOWN_SYMBOLS.includes(symbol.toLowerCase());
}
/**
 * Get symbol library from database
 */
async function getSymbolLibrary(userId) {
    const query = (0, database_1.default)('chart_symbol_templates')
        .select('symbol', 'name', 'category')
        .where('is_system', true);
    if (userId) {
        query.orWhere('user_id', userId);
    }
    return query;
}
exports.default = {
    detectChartFromImage,
    preprocessImage,
    detectGrid,
    extractCell,
    recognizeSymbol,
    applyCorrections,
    isValidSymbol,
    getSymbolLibrary,
};
