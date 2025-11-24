/**
 * Color Planning Service
 * Gradient generation, color palette tools, and yarn requirement calculations
 */

import sharp from 'sharp';

export interface ColorInput {
  id: string;
  name: string;
  hex: string;
}

export interface ColorTransition {
  color_id: string;
  color_name: string;
  hex_code: string;
  start_row: number;
  end_row: number;
  percentage: number;
}

export interface GradientConfig {
  total_rows: number;
  colors: ColorInput[];
  transition_style: 'linear' | 'smooth' | 'striped';
  stripe_width?: number; // For striped patterns
}

export interface HSL {
  h: number;
  s: number;
  l: number;
}

export interface ExtractedColor {
  hex: string;
  percentage: number;
  name?: string;
}

/**
 * Generate gradient color sequence
 */
export const generateGradientSequence = (
  config: GradientConfig
): ColorTransition[] => {
  const { total_rows, colors, transition_style, stripe_width = 4 } = config;
  const sequence: ColorTransition[] = [];

  if (colors.length === 0) {
    return sequence;
  }

  if (colors.length === 1) {
    // Single color fills all rows
    return [{
      color_id: colors[0].id,
      color_name: colors[0].name,
      hex_code: colors[0].hex,
      start_row: 1,
      end_row: total_rows,
      percentage: 100,
    }];
  }

  if (transition_style === 'linear') {
    // Evenly divide rows among colors
    const rowsPerColor = Math.floor(total_rows / colors.length);
    const remainder = total_rows % colors.length;
    let currentRow = 1;

    colors.forEach((color, idx) => {
      const extraRow = idx < remainder ? 1 : 0;
      const endRow = currentRow + rowsPerColor + extraRow - 1;

      sequence.push({
        color_id: color.id,
        color_name: color.name,
        hex_code: color.hex,
        start_row: currentRow,
        end_row: Math.min(endRow, total_rows),
        percentage: ((Math.min(endRow, total_rows) - currentRow + 1) / total_rows) * 100,
      });

      currentRow = endRow + 1;
    });
  } else if (transition_style === 'smooth') {
    // Gradual transitions with overlap (fade rows)
    const fadeRows = Math.max(2, Math.floor(total_rows / (colors.length * 4)));
    const effectiveRows = total_rows - (fadeRows * (colors.length - 1));
    const rowsPerColor = Math.floor(effectiveRows / colors.length);
    let currentRow = 1;

    colors.forEach((color, idx) => {
      const isLast = idx === colors.length - 1;
      let endRow: number;

      if (isLast) {
        endRow = total_rows;
      } else {
        endRow = currentRow + rowsPerColor + fadeRows - 1;
      }

      sequence.push({
        color_id: color.id,
        color_name: color.name,
        hex_code: color.hex,
        start_row: currentRow,
        end_row: Math.min(endRow, total_rows),
        percentage: ((Math.min(endRow, total_rows) - currentRow + 1) / total_rows) * 100,
      });

      if (!isLast) {
        currentRow = endRow - fadeRows + 1;
      }
    });
  } else if (transition_style === 'striped') {
    // Repeating stripes
    let currentRow = 1;
    let colorIdx = 0;

    while (currentRow <= total_rows) {
      const color = colors[colorIdx % colors.length];
      const endRow = Math.min(currentRow + stripe_width - 1, total_rows);

      sequence.push({
        color_id: color.id,
        color_name: color.name,
        hex_code: color.hex,
        start_row: currentRow,
        end_row: endRow,
        percentage: ((endRow - currentRow + 1) / total_rows) * 100,
      });

      currentRow = endRow + 1;
      colorIdx++;
    }
  }

  return sequence;
};

/**
 * Calculate yardage per color based on transitions
 */
export const calculateColorYardage = (
  totalYardage: number,
  colorTransitions: ColorTransition[]
): Map<string, { yardage: number; percentage: number; color_name: string; hex_code: string }> => {
  const yardageMap = new Map();

  colorTransitions.forEach((transition) => {
    const existing = yardageMap.get(transition.color_id);
    const transitionYardage = (totalYardage * transition.percentage) / 100;

    if (existing) {
      yardageMap.set(transition.color_id, {
        yardage: existing.yardage + transitionYardage,
        percentage: existing.percentage + transition.percentage,
        color_name: transition.color_name,
        hex_code: transition.hex_code,
      });
    } else {
      yardageMap.set(transition.color_id, {
        yardage: transitionYardage,
        percentage: transition.percentage,
        color_name: transition.color_name,
        hex_code: transition.hex_code,
      });
    }
  });

  return yardageMap;
};

/**
 * K-means clustering implementation for color extraction
 */
interface RGBColor {
  r: number;
  g: number;
  b: number;
}

function colorDistance(c1: RGBColor, c2: RGBColor): number {
  // Use weighted Euclidean distance (human perception)
  const rMean = (c1.r + c2.r) / 2;
  const dR = c1.r - c2.r;
  const dG = c1.g - c2.g;
  const dB = c1.b - c2.b;
  return Math.sqrt(
    (2 + rMean / 256) * dR * dR +
    4 * dG * dG +
    (2 + (255 - rMean) / 256) * dB * dB
  );
}

function kMeansClustering(
  pixels: RGBColor[],
  k: number,
  maxIterations: number = 20
): { centroid: RGBColor; count: number }[] {
  if (pixels.length === 0 || k <= 0) return [];

  // Initialize centroids using k-means++ for better initial positions
  const centroids: RGBColor[] = [];

  // First centroid is random
  centroids.push(pixels[Math.floor(Math.random() * pixels.length)]);

  // Remaining centroids chosen with probability proportional to distance squared
  for (let i = 1; i < k; i++) {
    const distances = pixels.map(p => {
      const minDist = Math.min(...centroids.map(c => colorDistance(p, c)));
      return minDist * minDist;
    });
    const totalDist = distances.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalDist;

    for (let j = 0; j < pixels.length; j++) {
      random -= distances[j];
      if (random <= 0) {
        centroids.push({ ...pixels[j] });
        break;
      }
    }
    if (centroids.length <= i) {
      centroids.push(pixels[Math.floor(Math.random() * pixels.length)]);
    }
  }

  // Iterate k-means
  let assignments = new Array(pixels.length).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign pixels to nearest centroid
    let changed = false;
    for (let i = 0; i < pixels.length; i++) {
      let minDist = Infinity;
      let minIdx = 0;
      for (let j = 0; j < centroids.length; j++) {
        const dist = colorDistance(pixels[i], centroids[j]);
        if (dist < minDist) {
          minDist = dist;
          minIdx = j;
        }
      }
      if (assignments[i] !== minIdx) {
        assignments[i] = minIdx;
        changed = true;
      }
    }

    if (!changed) break;

    // Update centroids
    const sums: { r: number; g: number; b: number; count: number }[] =
      Array.from({ length: k }, () => ({ r: 0, g: 0, b: 0, count: 0 }));

    for (let i = 0; i < pixels.length; i++) {
      const cluster = assignments[i];
      sums[cluster].r += pixels[i].r;
      sums[cluster].g += pixels[i].g;
      sums[cluster].b += pixels[i].b;
      sums[cluster].count++;
    }

    for (let j = 0; j < k; j++) {
      if (sums[j].count > 0) {
        centroids[j] = {
          r: Math.round(sums[j].r / sums[j].count),
          g: Math.round(sums[j].g / sums[j].count),
          b: Math.round(sums[j].b / sums[j].count),
        };
      }
    }
  }

  // Count pixels in each cluster
  const counts = new Array(k).fill(0);
  for (const assignment of assignments) {
    counts[assignment]++;
  }

  return centroids.map((centroid, i) => ({
    centroid,
    count: counts[i],
  }));
}

/**
 * Extract colors from image using k-means clustering
 */
export const extractColorsFromImage = async (
  imageBuffer: Buffer,
  numColors: number = 6
): Promise<ExtractedColor[]> => {
  try {
    // Resize image for faster processing
    const resized = await sharp(imageBuffer)
      .resize(100, 100, { fit: 'cover' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data, info } = resized;
    const pixels: RGBColor[] = [];

    // Extract pixel colors
    for (let i = 0; i < data.length; i += info.channels) {
      pixels.push({
        r: data[i],
        g: data[i + 1],
        b: data[i + 2],
      });
    }

    // Run k-means clustering
    const clusters = kMeansClustering(pixels, numColors);
    const totalPixels = pixels.length;

    // Sort by count and convert to result format
    return clusters
      .filter(c => c.count > 0)
      .sort((a, b) => b.count - a.count)
      .map(({ centroid, count }) => ({
        hex: rgbToHex(centroid.r, centroid.g, centroid.b),
        percentage: Math.round((count / totalPixels) * 100),
        name: getColorName(rgbToHex(centroid.r, centroid.g, centroid.b)),
      }));
  } catch (error) {
    console.error('Color extraction error:', error);
    // Return fallback colors
    return [
      { hex: '#2C3E50', percentage: 25, name: 'Dark Blue' },
      { hex: '#E74C3C', percentage: 20, name: 'Red' },
      { hex: '#3498DB', percentage: 18, name: 'Blue' },
      { hex: '#F39C12', percentage: 15, name: 'Orange' },
      { hex: '#27AE60', percentage: 12, name: 'Green' },
      { hex: '#9B59B6', percentage: 10, name: 'Purple' },
    ];
  }
};

/**
 * Generate harmonious color palette based on color theory
 */
export const generateColorPalette = (
  baseColor: string,
  scheme: 'analogous' | 'complementary' | 'triadic' | 'monochromatic' | 'split_complementary'
): string[] => {
  const hsl = hexToHSL(baseColor);

  switch (scheme) {
    case 'analogous':
      return [
        hslToHex({ h: (hsl.h - 30 + 360) % 360, s: hsl.s, l: hsl.l }),
        baseColor,
        hslToHex({ h: (hsl.h + 30) % 360, s: hsl.s, l: hsl.l }),
      ];

    case 'complementary':
      return [
        baseColor,
        hslToHex({ h: (hsl.h + 180) % 360, s: hsl.s, l: hsl.l }),
      ];

    case 'triadic':
      return [
        baseColor,
        hslToHex({ h: (hsl.h + 120) % 360, s: hsl.s, l: hsl.l }),
        hslToHex({ h: (hsl.h + 240) % 360, s: hsl.s, l: hsl.l }),
      ];

    case 'split_complementary':
      return [
        baseColor,
        hslToHex({ h: (hsl.h + 150) % 360, s: hsl.s, l: hsl.l }),
        hslToHex({ h: (hsl.h + 210) % 360, s: hsl.s, l: hsl.l }),
      ];

    case 'monochromatic':
      return [
        hslToHex({ h: hsl.h, s: hsl.s, l: Math.max(20, hsl.l - 20) }),
        baseColor,
        hslToHex({ h: hsl.h, s: hsl.s, l: Math.min(80, hsl.l + 20) }),
      ];

    default:
      return [baseColor];
  }
};

/**
 * Convert hex to HSL
 */
export function hexToHSL(hex: string): HSL {
  hex = hex.replace('#', '');

  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Convert HSL to hex
 */
export function hslToHex(hsl: HSL): string {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (x: number): string => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Convert RGB to hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (x: number): string => {
    const hex = Math.min(255, Math.max(0, x)).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Get approximate color name from hex
 */
function getColorName(hex: string): string {
  const hsl = hexToHSL(hex);

  // Grayscale
  if (hsl.s < 10) {
    if (hsl.l < 20) return 'Black';
    if (hsl.l < 40) return 'Dark Gray';
    if (hsl.l < 60) return 'Gray';
    if (hsl.l < 80) return 'Light Gray';
    return 'White';
  }

  // Determine base hue name
  let hueName: string;
  const h = hsl.h;

  if (h < 15 || h >= 345) hueName = 'Red';
  else if (h < 45) hueName = 'Orange';
  else if (h < 75) hueName = 'Yellow';
  else if (h < 150) hueName = 'Green';
  else if (h < 210) hueName = 'Cyan';
  else if (h < 270) hueName = 'Blue';
  else if (h < 315) hueName = 'Purple';
  else hueName = 'Pink';

  // Add lightness/darkness modifier
  if (hsl.l < 30) return `Dark ${hueName}`;
  if (hsl.l > 70) return `Light ${hueName}`;

  return hueName;
}

/**
 * Calculate contrast ratio between two colors (WCAG)
 */
export function calculateContrastRatio(color1: string, color2: string): number {
  const getLuminance = (hex: string): number => {
    hex = hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const adjust = (c: number): number =>
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

    return 0.2126 * adjust(r) + 0.7152 * adjust(g) + 0.0722 * adjust(b);
  };

  const l1 = getLuminance(color1);
  const l2 = getLuminance(color2);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Suggest readable text color for a background
 */
export function getReadableTextColor(backgroundColor: string): string {
  const whiteContrast = calculateContrastRatio(backgroundColor, '#FFFFFF');
  const blackContrast = calculateContrastRatio(backgroundColor, '#000000');

  return whiteContrast > blackContrast ? '#FFFFFF' : '#000000';
}

export default {
  generateGradientSequence,
  calculateColorYardage,
  extractColorsFromImage,
  generateColorPalette,
  hexToHSL,
  hslToHex,
  calculateContrastRatio,
  getReadableTextColor,
};
