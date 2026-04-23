import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FeasibilityBadge from './FeasibilityBadge';

describe('FeasibilityBadge', () => {
  it('renders "Ready" label with green classes for green status', () => {
    render(<FeasibilityBadge status="green" patternId="p1" />);
    const el = screen.getByTestId('feasibility-badge-p1');
    expect(el).toHaveTextContent('Ready');
    expect(el.className).toMatch(/green/);
  });

  it('renders "Check caveats" label with yellow classes for yellow status', () => {
    render(<FeasibilityBadge status="yellow" patternId="p2" />);
    const el = screen.getByTestId('feasibility-badge-p2');
    expect(el).toHaveTextContent('Check caveats');
    expect(el.className).toMatch(/yellow/);
  });

  it('renders "Missing materials" label with red classes for red status', () => {
    render(<FeasibilityBadge status="red" patternId="p3" />);
    const el = screen.getByTestId('feasibility-badge-p3');
    expect(el).toHaveTextContent('Missing materials');
    expect(el.className).toMatch(/red/);
  });

  it('has a tooltip explaining how to get the full breakdown', () => {
    render(<FeasibilityBadge status="green" patternId="p4" />);
    const el = screen.getByTestId('feasibility-badge-p4');
    expect(el.getAttribute('title')).toMatch(/View Details/);
  });
});
