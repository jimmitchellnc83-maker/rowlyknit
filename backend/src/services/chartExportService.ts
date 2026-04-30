/**
 * Chart Export Service
 * Export charts in multiple formats: PDF, PNG, CSV, Ravelry JSON, Markdown
 */

import PDFDocument from 'pdfkit';
import sharp from 'sharp';

export interface ExportOptions {
  // PDF options
  page_size?: 'letter' | 'a4' | 'legal';
  orientation?: 'portrait' | 'landscape';
  cell_size?: 'small' | 'medium' | 'large';
  include_legend?: boolean;
  include_notes?: boolean;
  include_row_numbers?: boolean;
  include_column_numbers?: boolean;
  /** Draw the chart's repeat-region box (dashed purple rectangle) when
   *  the chart has one. Default true. No-op when the chart payload has
   *  no repeat_region. */
  include_repeat_box?: boolean;
  /** SVG stroke-width for cell borders. Default 1. Knitters with weak
   *  printers / low-contrast screens often want a heavier 1.5–2 px
   *  outline; designers preparing publication-quality output sometimes
   *  want 0.5. */
  grid_weight?: number;
  /** Multiplier for the stitch symbol font size. Default 1.0. Useful
   *  when the auto-derived size (clamped to cell size) reads too small
   *  in print or too crowded in tight layouts. Range ~0.5–1.5. */
  symbol_scale?: number;
  smart_page_breaks?: boolean;

  // PNG options
  resolution?: number; // DPI

  // General
  title?: string;
  author?: string;
}

export interface ChartData {
  id: string;
  name: string;
  grid: string[][];
  rows: number;
  columns: number;
  symbol_legend?: Record<string, string>;
  notes?: string;
  description?: string;
  designer?: string;
  /** Optional repeat-region box, mirroring the on-screen ChartGrid
   *  overlay. 0-indexed columns / rows, inclusive. Today the `charts`
   *  table doesn't persist this — the column needs to be added by a v2
   *  schema migration — but the renderer is wired so the moment that
   *  migration lands and the controller reads it, exports will pick it
   *  up automatically. */
  repeat_region?: {
    startCol: number;
    endCol: number;
    startRow?: number;
    endRow?: number;
  };
}

const CELL_SIZES = {
  small: 12,
  medium: 20,
  large: 32,
};

const PAGE_SIZES = {
  letter: { width: 612, height: 792 },
  a4: { width: 595, height: 842 },
  legal: { width: 612, height: 1008 },
};

/**
 * Export chart to PDF
 */
export const exportToPDF = async (
  chart: ChartData,
  options: ExportOptions = {}
): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const pageSize = options.page_size || 'letter';
      const orientation = options.orientation || 'portrait';
      const cellSize = CELL_SIZES[options.cell_size || 'medium'];
      const includeLegend = options.include_legend !== false;
      const includeRowNumbers = options.include_row_numbers !== false;

      const { width: pageWidth, height: pageHeight } = PAGE_SIZES[pageSize];
      const docWidth = orientation === 'landscape' ? pageHeight : pageWidth;
      const docHeight = orientation === 'landscape' ? pageWidth : pageHeight;

      const doc = new PDFDocument({
        size: orientation === 'landscape' ? [pageHeight, pageWidth] : pageSize.toUpperCase(),
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: any) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Title
      doc.fontSize(18).font('Helvetica-Bold');
      doc.text(options.title || chart.name, { align: 'center' });
      doc.moveDown();

      if (options.author || chart.designer) {
        doc.fontSize(10).font('Helvetica');
        doc.text(`Designer: ${options.author || chart.designer}`, { align: 'center' });
        doc.moveDown();
      }

      // Description
      if (chart.description) {
        doc.fontSize(10).font('Helvetica');
        doc.text(chart.description, { align: 'left' });
        doc.moveDown();
      }

      // Chart grid
      const grid = typeof chart.grid === 'string' ? JSON.parse(chart.grid) : chart.grid;
      const chartRows = grid.length;
      const chartCols = grid[0]?.length || 0;

      const rowNumberWidth = includeRowNumbers ? 30 : 0;
      const availableWidth = docWidth - 100 - rowNumberWidth;
      const availableHeight = docHeight - 200;

      // Calculate actual cell size to fit
      const maxCellWidth = Math.floor(availableWidth / chartCols);
      const maxCellHeight = Math.floor(availableHeight / chartRows);
      const actualCellSize = Math.min(cellSize, maxCellWidth, maxCellHeight, 30);

      const chartStartX = 50 + rowNumberWidth;
      const chartStartY = doc.y + 20;

      doc.fontSize(8).font('Helvetica');

      // Draw chart
      for (let row = 0; row < chartRows; row++) {
        const y = chartStartY + row * actualCellSize;

        // Row number (traditional: bottom to top)
        if (includeRowNumbers) {
          doc.text(
            String(chartRows - row),
            50,
            y + actualCellSize / 3,
            { width: rowNumberWidth - 5, align: 'right' }
          );
        }

        for (let col = 0; col < chartCols; col++) {
          const x = chartStartX + col * actualCellSize;
          const symbol = grid[row][col] || '';

          // Draw cell border
          doc.rect(x, y, actualCellSize, actualCellSize).stroke();

          // Draw symbol
          if (symbol) {
            doc.text(
              symbol,
              x + 2,
              y + actualCellSize / 3,
              { width: actualCellSize - 4, align: 'center' }
            );
          }
        }
      }

      // Move below chart
      doc.y = chartStartY + chartRows * actualCellSize + 20;

      // Legend
      if (includeLegend && chart.symbol_legend) {
        const legend = typeof chart.symbol_legend === 'string'
          ? JSON.parse(chart.symbol_legend)
          : chart.symbol_legend;

        if (Object.keys(legend).length > 0) {
          doc.moveDown();
          doc.fontSize(12).font('Helvetica-Bold');
          doc.text('Symbol Legend', { align: 'left' });
          doc.moveDown(0.5);

          doc.fontSize(10).font('Helvetica');
          Object.entries(legend).forEach(([symbol, meaning]) => {
            doc.text(`${symbol}: ${meaning}`);
          });
        }
      }

      // Notes
      if (options.include_notes && chart.notes) {
        doc.moveDown();
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text('Notes', { align: 'left' });
        doc.moveDown(0.5);

        doc.fontSize(10).font('Helvetica');
        doc.text(chart.notes);
      }

      // Footer
      doc.fontSize(8).font('Helvetica');
      doc.text(
        `Generated by RowlyKnit | ${new Date().toLocaleDateString()}`,
        50,
        docHeight - 30,
        { align: 'center', width: docWidth - 100 }
      );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Build the chart SVG markup. Shared by PNG, PDF, and SVG export so all
 * three render the same way; the only difference is the final encoding.
 */
const buildChartSvg = (chart: ChartData, options: ExportOptions = {}): string => {
  const cellSize = CELL_SIZES[options.cell_size || 'large'];
  const grid = typeof chart.grid === 'string' ? JSON.parse(chart.grid) : chart.grid;
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  // Stroke width for cell borders. Clamp to a sane range so an
  // accidental 0 doesn't render an invisible grid and an accidental
  // 100 doesn't paint over the symbols.
  const gridWeight = Math.min(5, Math.max(0.25, options.grid_weight ?? 1));
  // Symbol font scale. Same clamp logic — the lower bound keeps the
  // glyphs readable, the upper bound keeps them inside the cell.
  const symbolScale = Math.min(1.5, Math.max(0.5, options.symbol_scale ?? 1));

  const padding = 20;
  const rowNumberWidth = options.include_row_numbers !== false ? 40 : 0;
  const headerHeight = 40;

  const width = cols * cellSize + padding * 2 + rowNumberWidth;
  const height = rows * cellSize + padding * 2 + headerHeight;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;

  // Background
  svg += `<rect width="${width}" height="${height}" fill="white"/>`;

  // Title
  svg += `<text x="${width / 2}" y="25" text-anchor="middle" font-family="Arial" font-size="16" font-weight="bold">${escapeXml(chart.name)}</text>`;

  // Chart grid
  const chartStartX = padding + rowNumberWidth;
  const chartStartY = padding + headerHeight;

  for (let row = 0; row < rows; row++) {
    const y = chartStartY + row * cellSize;

    // Row number
    if (options.include_row_numbers !== false) {
      svg += `<text x="${padding + rowNumberWidth - 5}" y="${y + cellSize / 2 + 4}" text-anchor="end" font-family="Arial" font-size="10">${rows - row}</text>`;
    }

    for (let col = 0; col < cols; col++) {
      const x = chartStartX + col * cellSize;
      const symbol = grid[row][col] || '';

      // Cell border
      svg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="white" stroke="#999" stroke-width="${gridWeight}"/>`;

      // Symbol
      if (symbol) {
        const symbolFontSize = Math.min(cellSize - 4, 14) * symbolScale;
        svg += `<text x="${x + cellSize / 2}" y="${y + cellSize / 2 + 4}" text-anchor="middle" font-family="Arial" font-size="${symbolFontSize}">${escapeXml(symbol)}</text>`;
      }
    }
  }

  // Repeat-box overlay — dashed purple rectangle around the repeat
  // columns (and rows, when set). Mirrors ChartGrid.tsx's on-screen
  // overlay so what knitters see in the editor matches the export.
  // Default ON; explicitly set include_repeat_box=false to suppress.
  const includeRepeat = options.include_repeat_box !== false;
  const region = chart.repeat_region;
  if (
    includeRepeat &&
    region &&
    region.startCol >= 0 &&
    region.endCol < cols &&
    region.startCol <= region.endCol
  ) {
    const boxX = chartStartX + region.startCol * cellSize;
    const boxY =
      typeof region.startRow === 'number' && region.startRow >= 0
        ? chartStartY + region.startRow * cellSize
        : chartStartY;
    const boxW = (region.endCol - region.startCol + 1) * cellSize;
    const boxH =
      typeof region.endRow === 'number' && region.endRow < rows
        ? (region.endRow - (region.startRow ?? 0) + 1) * cellSize
        : rows * cellSize;
    svg += `<rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" fill="none" stroke="#7c3aed" stroke-width="2" stroke-dasharray="6,4"/>`;
  }

  svg += '</svg>';
  return svg;
};

/**
 * Export chart to PNG
 */
export const exportToPNG = async (
  chart: ChartData,
  options: ExportOptions = {}
): Promise<Buffer> => {
  const svg = buildChartSvg(chart, options);
  // Convert SVG to PNG using sharp
  return sharp(Buffer.from(svg))
    .png()
    .toBuffer();
};

/**
 * Export chart to SVG (raw, vector). Same renderer as PNG/PDF — the
 * difference is only the encoding, so what designers see in PNG is byte-
 * equivalent in SVG.
 */
export const exportToSVG = (chart: ChartData, options: ExportOptions = {}): Buffer => {
  return Buffer.from(buildChartSvg(chart, options), 'utf-8');
};

/**
 * Export chart to CSV
 */
export const exportToCSV = (chart: ChartData): Buffer => {
  const grid = typeof chart.grid === 'string' ? JSON.parse(chart.grid) : chart.grid;

  const rows = grid.map((row: string[]) =>
    row.map((cell) => `"${(cell || '').replace(/"/g, '""')}"`).join(',')
  );

  const csv = rows.join('\n');
  return Buffer.from(csv, 'utf-8');
};

/**
 * Export chart to Ravelry JSON format
 */
export const exportToRavelry = (chart: ChartData): Buffer => {
  const grid = typeof chart.grid === 'string' ? JSON.parse(chart.grid) : chart.grid;
  const legend = typeof chart.symbol_legend === 'string'
    ? JSON.parse(chart.symbol_legend || '{}')
    : (chart.symbol_legend || {});

  const ravelryFormat = {
    name: chart.name,
    designer: chart.designer || 'Unknown',
    pattern_type: 'chart',
    chart_data: grid,
    rows: chart.rows,
    columns: chart.columns,
    symbol_legend: legend,
    notes: chart.notes || '',
    description: chart.description || '',
    created_with: 'RowlyKnit',
    export_version: '1.0',
    exported_at: new Date().toISOString(),
  };

  return Buffer.from(JSON.stringify(ravelryFormat, null, 2), 'utf-8');
};

/**
 * Export chart to Markdown
 */
export const exportToMarkdown = (chart: ChartData): Buffer => {
  const grid = typeof chart.grid === 'string' ? JSON.parse(chart.grid) : chart.grid;
  const legend = typeof chart.symbol_legend === 'string'
    ? JSON.parse(chart.symbol_legend || '{}')
    : (chart.symbol_legend || {});

  let md = `# ${chart.name}\n\n`;

  if (chart.designer) {
    md += `**Designer:** ${chart.designer}\n\n`;
  }

  if (chart.description) {
    md += `${chart.description}\n\n`;
  }

  md += '## Chart\n\n';
  md += `Size: ${chart.columns} stitches × ${chart.rows} rows\n\n`;

  md += '```\n';
  grid.forEach((row: string[], idx: number) => {
    const rowNum = String(grid.length - idx).padStart(3, ' ');
    md += `Row ${rowNum}: ${row.join(' ')}\n`;
  });
  md += '```\n\n';

  if (Object.keys(legend).length > 0) {
    md += '## Symbol Legend\n\n';
    Object.entries(legend).forEach(([symbol, meaning]) => {
      md += `- **${symbol}**: ${meaning}\n`;
    });
    md += '\n';
  }

  if (chart.notes) {
    md += '## Notes\n\n';
    md += `${chart.notes}\n\n`;
  }

  md += '---\n';
  md += `*Exported from RowlyKnit on ${new Date().toLocaleDateString()}*\n`;

  return Buffer.from(md, 'utf-8');
};

/**
 * Main export function - routes to appropriate format
 */
export const exportChart = async (
  chart: ChartData,
  format: 'pdf' | 'png' | 'svg' | 'csv' | 'ravelry' | 'markdown',
  options: ExportOptions = {}
): Promise<{ buffer: Buffer; mimeType: string; extension: string }> => {
  switch (format) {
    case 'pdf':
      return {
        buffer: await exportToPDF(chart, options),
        mimeType: 'application/pdf',
        extension: 'pdf',
      };

    case 'png':
      return {
        buffer: await exportToPNG(chart, options),
        mimeType: 'image/png',
        extension: 'png',
      };

    case 'svg':
      return {
        buffer: exportToSVG(chart, options),
        mimeType: 'image/svg+xml',
        extension: 'svg',
      };

    case 'csv':
      return {
        buffer: exportToCSV(chart),
        mimeType: 'text/csv',
        extension: 'csv',
      };

    case 'ravelry':
      return {
        buffer: exportToRavelry(chart),
        mimeType: 'application/json',
        extension: 'json',
      };

    case 'markdown':
      return {
        buffer: exportToMarkdown(chart),
        mimeType: 'text/markdown',
        extension: 'md',
      };

    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
};

// Helper function to escape XML special characters
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default {
  exportToPDF,
  exportToPNG,
  exportToCSV,
  exportToRavelry,
  exportToMarkdown,
  exportChart,
};
