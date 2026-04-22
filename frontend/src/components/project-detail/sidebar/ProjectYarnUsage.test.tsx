import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProjectYarnUsage from './ProjectYarnUsage';

function yarnEntry(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'y1',
    brand: 'Cascade',
    name: '220',
    color: 'Red',
    weight: 'worsted',
    skeins_used: 2,
    skeins_remaining: 4,
    yards_used: 440,
    yards_remaining: 880,
    price_per_skein: 12.5,
    low_stock_alert: false,
    ...overrides,
  };
}

function renderWith(yarn: ReturnType<typeof yarnEntry>[]) {
  return render(
    <MemoryRouter>
      <ProjectYarnUsage yarn={yarn} onRemove={vi.fn()} onAddClick={vi.fn()} />
    </MemoryRouter>,
  );
}

describe('ProjectYarnUsage cost line', () => {
  it('shows total project yarn cost when at least one entry is priced', () => {
    renderWith([yarnEntry({ skeins_used: 2, price_per_skein: 10 })]);
    const card = screen.getByLabelText('Project yarn cost');
    // $20.00 appears in the total and inline; scope to the card to avoid ambiguity.
    expect(card).toHaveTextContent('$20.00');
  });

  it('sums costs across multiple priced entries', () => {
    renderWith([
      yarnEntry({ id: 'a', skeins_used: 2, price_per_skein: 10 }),
      yarnEntry({ id: 'b', skeins_used: 3, price_per_skein: 8 }),
    ]);
    // 2*10 + 3*8 = 44
    expect(screen.getByText('$44.00')).toBeInTheDocument();
  });

  it('flags the total as a lower bound when some yarns are unpriced', () => {
    renderWith([
      yarnEntry({ id: 'a', skeins_used: 2, price_per_skein: 10 }),
      yarnEntry({ id: 'b', skeins_used: 3, price_per_skein: null }),
    ]);
    expect(screen.getByText(/1 yarn without a price/i)).toBeInTheDocument();
    expect(screen.getByText(/lower bound/i)).toBeInTheDocument();
  });

  it('hides the cost card entirely when no yarns have a price', () => {
    renderWith([yarnEntry({ price_per_skein: null })]);
    expect(screen.queryByLabelText('Project yarn cost')).not.toBeInTheDocument();
  });

  it('hides the cost card when no yarn is attached', () => {
    renderWith([]);
    expect(screen.queryByLabelText('Project yarn cost')).not.toBeInTheDocument();
  });

  it('renders per-entry cost inline with the skein count', () => {
    const { container } = renderWith([yarnEntry({ skeins_used: 2, price_per_skein: 12.5 })]);
    // The inline per-entry cost is 2 * 12.5 = 25
    expect(container.textContent).toContain('$25.00');
  });

  it('treats numeric strings as numbers (pg returns numeric columns as strings)', () => {
    renderWith([
      yarnEntry({
        skeins_used: 2,
        price_per_skein: '12.50' as unknown as number,
      }),
    ]);
    // $25.00 shows both in the total card and the per-entry row.
    expect(screen.getAllByText('$25.00').length).toBeGreaterThanOrEqual(1);
  });

  it('ignores non-positive prices', () => {
    renderWith([yarnEntry({ skeins_used: 5, price_per_skein: 0 })]);
    expect(screen.queryByLabelText('Project yarn cost')).not.toBeInTheDocument();
  });
});
