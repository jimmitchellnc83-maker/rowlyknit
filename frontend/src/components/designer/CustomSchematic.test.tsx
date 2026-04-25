import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import CustomSchematic from './CustomSchematic';
import { DEFAULT_CUSTOM_SHAPE, type CustomShape } from '../../types/customShape';
import type { ChartData } from './ChartGrid';

describe('CustomSchematic', () => {
  it('renders the polygon path when 3+ vertices are present', () => {
    const { container } = render(
      <CustomSchematic shape={DEFAULT_CUSTOM_SHAPE} unit="in" />,
    );
    const paths = Array.from(container.querySelectorAll('path'));
    expect(paths.length).toBeGreaterThan(0);
    // Default shape has 4 vertices → 4 L commands
    const polygonPath = paths.find((p) => (p.getAttribute('d') ?? '').startsWith('M'));
    expect(polygonPath).toBeTruthy();
  });

  it('shows a placeholder when fewer than 3 vertices', () => {
    const tooFew: CustomShape = {
      widthInches: 10,
      heightInches: 10,
      vertices: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    };
    const { container } = render(<CustomSchematic shape={tooFew} unit="in" />);
    expect(container.textContent).toContain('Add at least 3 vertices');
  });

  it('shows width and height labels using the unit prop', () => {
    const { container } = render(
      <CustomSchematic shape={DEFAULT_CUSTOM_SHAPE} unit="in" />,
    );
    expect(container.textContent).toMatch(/24 in wide/);
    expect(container.textContent).toMatch(/24 in tall/);
  });

  it('converts labels when unit=cm', () => {
    const { container } = render(
      <CustomSchematic shape={DEFAULT_CUSTOM_SHAPE} unit="cm" />,
    );
    // 24 in × 2.54 = 60.96 → rounds to 61 (nearest 0.5)
    expect(container.textContent).toMatch(/61 cm wide/);
    expect(container.textContent).toMatch(/61 cm tall/);
  });

  it('renders chart cells when colorwork is present', () => {
    const chart: ChartData = {
      width: 1,
      height: 1,
      cells: [{ symbolId: null, colorHex: '#ff0000' }],
    };
    const { container } = render(
      <CustomSchematic
        shape={DEFAULT_CUSTOM_SHAPE}
        unit="in"
        chart={chart}
        stitchesPerInch={5}
        rowsPerInch={7}
      />,
    );
    // Chart overlay tiles colored cells inside the polygon clip
    const colorRects = Array.from(container.querySelectorAll('rect[fill="#ff0000"]'));
    expect(colorRects.length).toBeGreaterThan(0);
  });
});
