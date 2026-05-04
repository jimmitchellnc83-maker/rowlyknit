/**
 * QA sprint 2026-05-04: pre-fix the increment "+" button on the chart-row
 * tracker had no upper-bound check, so it rendered enabled even when the
 * knitter was already on the last chart row. Decrement was always
 * properly gated at row 1; this test pins the symmetric behavior at the
 * top of the chart.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChartRowTracker from './ChartRowTracker';
import type { ChartData } from '../designer/ChartGrid';

function chart(height = 4): ChartData {
  const width = 3;
  return {
    width,
    height,
    cells: Array.from({ length: width * height }, () => ({
      symbolId: null,
      colorHex: null,
    })),
  };
}

describe('ChartRowTracker step buttons', () => {
  it('disables decrement at row 1 and enables increment', () => {
    render(
      <ChartRowTracker
        chart={chart()}
        currentRow={1}
        onStep={vi.fn()}
        counterName="Body"
      />,
    );
    expect(screen.getByLabelText(/previous chart row/i)).toBeDisabled();
    expect(screen.getByLabelText(/next chart row/i)).not.toBeDisabled();
  });

  it('disables increment at the last chart row and enables decrement', () => {
    render(
      <ChartRowTracker
        chart={chart(4)}
        currentRow={4}
        onStep={vi.fn()}
        counterName="Body"
      />,
    );
    expect(screen.getByLabelText(/next chart row/i)).toBeDisabled();
    expect(screen.getByLabelText(/previous chart row/i)).not.toBeDisabled();
  });

  it('enables both step buttons mid-chart', () => {
    render(
      <ChartRowTracker
        chart={chart(8)}
        currentRow={4}
        onStep={vi.fn()}
        counterName="Body"
      />,
    );
    expect(screen.getByLabelText(/next chart row/i)).not.toBeDisabled();
    expect(screen.getByLabelText(/previous chart row/i)).not.toBeDisabled();
  });

  it('disables both step buttons when the parent passes disabled=true', () => {
    render(
      <ChartRowTracker
        chart={chart(8)}
        currentRow={4}
        onStep={vi.fn()}
        counterName="Body"
        disabled
      />,
    );
    expect(screen.getByLabelText(/next chart row/i)).toBeDisabled();
    expect(screen.getByLabelText(/previous chart row/i)).toBeDisabled();
  });
});
