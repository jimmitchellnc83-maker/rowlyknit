import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ChartLegend from './ChartLegend';
import type { ChartData, ChartCell } from './ChartGrid';
import type { ColorSwatch } from './ColorPalette';

vi.mock('axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: {
        data: {
          system: [
            { symbol: 'k', name: 'Knit', abbreviation: 'k', is_system: true, cell_span: 1, category: 'basic' },
            { symbol: 'p', name: 'Purl', abbreviation: 'p', is_system: true, cell_span: 1, category: 'basic' },
            { symbol: 'k2tog', name: 'Knit two together', abbreviation: 'k2tog', is_system: true, cell_span: 1, category: 'decrease' },
          ],
          custom: [],
        },
      },
    }),
  },
}));

function cell(symbolId: string | null, colorHex: string | null = null): ChartCell {
  return { symbolId, colorHex };
}

function chartFromGrid(rows: ChartCell[][]): ChartData {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const cells: ChartCell[] = [];
  for (const row of rows) cells.push(...row);
  return { width, height, cells };
}

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const NO_COLORS: ColorSwatch[] = [];

describe('ChartLegend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when chart is empty', () => {
    const chart = chartFromGrid([
      [cell(null), cell(null)],
      [cell(null), cell(null)],
    ]);
    const { container } = renderWithClient(
      <ChartLegend chart={chart} craft="knit" paletteColors={NO_COLORS} />,
    );
    expect(container.querySelector('section')).toBeNull();
  });

  it('lists symbols actually used (without no-stitch)', async () => {
    const chart = chartFromGrid([
      [cell('k'), cell('p'), cell('no-stitch')],
      [cell('k'), cell('k'), cell('k')],
    ]);
    renderWithClient(<ChartLegend chart={chart} craft="knit" paletteColors={NO_COLORS} />);

    expect(await screen.findByText(/—\s*Knit/)).toBeInTheDocument();
    expect(await screen.findByText(/—\s*Purl/)).toBeInTheDocument();
    expect(screen.getByText(/No stitch — skip this cell/i)).toBeInTheDocument();
  });

  it('shows the no-stitch line when no-stitch cells are present even with no other symbols', () => {
    const chart = chartFromGrid([
      [cell('no-stitch'), cell(null)],
      [cell(null), cell(null)],
    ]);
    renderWithClient(<ChartLegend chart={chart} craft="knit" paletteColors={NO_COLORS} />);
    expect(screen.getByText(/No stitch — skip this cell/i)).toBeInTheDocument();
  });

  it('lists distinct used colors with palette labels when matched', () => {
    const chart = chartFromGrid([
      [cell(null, '#ff0000'), cell(null, '#00ff00'), cell(null, '#ff0000')],
      [cell(null, '#ABCDEF'), cell(null, null), cell(null, null)],
    ]);
    const colors: ColorSwatch[] = [
      { id: '1', label: 'Cardinal', hex: '#FF0000' },
      { id: '2', label: 'Lime', hex: '#00FF00' },
    ];
    renderWithClient(<ChartLegend chart={chart} craft="knit" paletteColors={colors} />);
    expect(screen.getByText('Cardinal')).toBeInTheDocument();
    expect(screen.getByText('Lime')).toBeInTheDocument();
    expect(screen.getByText('#ABCDEF')).toBeInTheDocument();
  });

  it('treats hex case-insensitively when matching palette labels', () => {
    const chart = chartFromGrid([[cell(null, '#aabbcc')]]);
    const colors: ColorSwatch[] = [{ id: '1', label: 'Slate', hex: '#AABBCC' }];
    renderWithClient(<ChartLegend chart={chart} craft="knit" paletteColors={colors} />);
    expect(screen.getByText('Slate')).toBeInTheDocument();
  });
});
