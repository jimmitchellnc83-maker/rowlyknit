import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CycEventBanner from './CycEventBanner';

describe('CycEventBanner', () => {
  it('renders nothing on a non-event date', () => {
    const { container } = render(<CycEventBanner now={new Date('2026-07-15T12:00:00Z')} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the Stitch Away Stress card during April', () => {
    render(<CycEventBanner now={new Date('2026-04-15T12:00:00Z')} />);
    expect(screen.getByText('Stitch Away Stress')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy #StitchAwayStress/i })).toBeInTheDocument();
  });

  it('shows the I Love Yarn Day card on the 2nd Saturday of October', () => {
    render(<CycEventBanner now={new Date('2026-10-10T15:00:00Z')} />);
    expect(screen.getByText('I Love Yarn Day')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy #iloveyarnday/i })).toBeInTheDocument();
  });

  it('copies the hashtag and flips the button label to "Copied" on click', () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    render(<CycEventBanner now={new Date('2026-04-15T12:00:00Z')} />);
    const btn = screen.getByRole('button', { name: /Copy #StitchAwayStress/i });
    fireEvent.click(btn);
    expect(writeText).toHaveBeenCalledWith('#StitchAwayStress');
    expect(screen.getByText('Copied')).toBeInTheDocument();
  });

  it('honors the filter prop', () => {
    // April 15 — only SAS would render. Filter keeps only ily-day → empty.
    const { container } = render(
      <CycEventBanner
        now={new Date('2026-04-15T12:00:00Z')}
        filter={(e) => e.id === 'i-love-yarn-day'}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
