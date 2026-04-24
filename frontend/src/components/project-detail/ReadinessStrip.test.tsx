import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ReadinessStrip from './ReadinessStrip';

const noop = () => {};

const EMPTY_PROPS = {
  patterns: [],
  counters: [],
  yarn: [],
  tools: [],
  onAddPattern: noop,
  onAddYarn: noop,
  onAddTool: noop,
};

describe('ReadinessStrip', () => {
  it('renders one button per readiness dimension', () => {
    render(<ReadinessStrip {...EMPTY_PROPS} />);
    for (const label of ['Pattern', 'Counter', 'Yarn', 'Tools', 'Pieces', 'Notes']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('shows "missing" hint when no pattern, counter, or yarn is attached', () => {
    render(<ReadinessStrip {...EMPTY_PROPS} />);
    expect(screen.getByText(/Attach the pattern/i)).toBeInTheDocument();
    expect(screen.getByText(/unlock Knitting Mode/i)).toBeInTheDocument();
    expect(screen.getByText(/Assign yarn to check feasibility/i)).toBeInTheDocument();
  });

  it('shows "ready" counts when data is present', () => {
    render(
      <ReadinessStrip
        {...EMPTY_PROPS}
        patterns={[{ id: 'p1' }]}
        counters={[{ id: 'c1' }, { id: 'c2' }]}
        yarn={[{ id: 'y1' }]}
        tools={[{ id: 't1' }]}
        pieces={[{ id: 'pc1' }, { id: 'pc2' }]}
        notes="draft note"
      />,
    );
    expect(screen.getByText('1 attached')).toBeInTheDocument();
    expect(screen.getByText('2 active')).toBeInTheDocument();
    expect(screen.getByText('1 assigned')).toBeInTheDocument();
    expect(screen.getByText('1 tool assigned')).toBeInTheDocument();
    expect(screen.getByText('2 pieces tracked')).toBeInTheDocument();
    expect(screen.getByText('Notes started')).toBeInTheDocument();
  });

  it('surfaces needle conflict on Tools chip when needleCheck is red', () => {
    render(
      <ReadinessStrip
        {...EMPTY_PROPS}
        tools={[{ id: 't1' }]}
        needleCheck={{
          status: 'red',
          requiredSizesMm: [3.5, 4.0],
          missingSizesMm: [3.5, 4.0],
          partialSizesMm: [],
          matches: [],
          message: 'Missing needles',
        }}
      />,
    );
    expect(screen.getByText(/Missing 2 size\(s\)/i)).toBeInTheDocument();
  });

  it('calls onAddPattern when the missing Pattern chip is clicked', () => {
    const onAddPattern = vi.fn();
    render(<ReadinessStrip {...EMPTY_PROPS} onAddPattern={onAddPattern} />);
    const chip = screen.getByRole('button', {
      name: /Pattern: Attach the pattern you're following/i,
    });
    fireEvent.click(chip);
    expect(onAddPattern).toHaveBeenCalledTimes(1);
  });

  it('treats whitespace-only notes as empty (optional)', () => {
    render(<ReadinessStrip {...EMPTY_PROPS} notes={'   \n  '} />);
    expect(screen.getByText(/Jot setup decisions/i)).toBeInTheDocument();
  });
});
