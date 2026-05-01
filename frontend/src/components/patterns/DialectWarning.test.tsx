import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DialectWarning from './DialectWarning';
import { detectCrochetDialect } from '../../utils/crochetDialect';

describe('DialectWarning', () => {
  it('renders the warning when detected dialect mismatches the target', () => {
    const detection = detectCrochetDialect('htr in next, htr in next, tension 16 sts');
    render(
      <DialectWarning
        detection={detection}
        targetDialect="us"
        onConvert={vi.fn()}
      />
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/looks like/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Convert to US/i })).toBeInTheDocument();
  });

  it('renders nothing when detection is unknown', () => {
    const detection = detectCrochetDialect('Row 1: ch 20, work in pattern.');
    const { container } = render(
      <DialectWarning
        detection={detection}
        targetDialect="us"
        onConvert={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when detected dialect already matches target', () => {
    const detection = detectCrochetDialect('sc sc sc');
    const { container } = render(
      <DialectWarning
        detection={detection}
        targetDialect="us"
        onConvert={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('flips to a converted-confirmation banner when `converted` is set', () => {
    const detection = detectCrochetDialect('htr htr htr');
    render(
      <DialectWarning
        detection={detection}
        targetDialect="us"
        onConvert={vi.fn()}
        converted
      />
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/Converted from UK to US/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Convert/i })).not.toBeInTheDocument();
  });

  it('calls onConvert when the convert button is clicked', () => {
    const detection = detectCrochetDialect('htr htr htr');
    const onConvert = vi.fn();
    render(
      <DialectWarning
        detection={detection}
        targetDialect="us"
        onConvert={onConvert}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Convert to US/i }));
    expect(onConvert).toHaveBeenCalledTimes(1);
  });

  it('shows a low-confidence note when confidence is below 0.7', () => {
    // 2-vs-1 → confidence 0.667 → low confidence
    const detection = detectCrochetDialect('htr htr sc');
    render(
      <DialectWarning
        detection={detection}
        targetDialect="us"
        onConvert={vi.fn()}
      />
    );
    expect(screen.getByText(/low confidence/i)).toBeInTheDocument();
  });

  it('lists ambiguous tokens when present', () => {
    const detection = detectCrochetDialect('htr in 4th ch, dc in next, tr at end');
    render(
      <DialectWarning
        detection={detection}
        targetDialect="us"
        onConvert={vi.fn()}
      />
    );
    expect(screen.getByText(/Ambiguous tokens/)).toBeInTheDocument();
  });
});
