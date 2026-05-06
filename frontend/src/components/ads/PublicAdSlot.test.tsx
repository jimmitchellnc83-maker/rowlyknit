/**
 * Behavioural tests for the AdSense slot component. The component is
 * a thin route-gate around an `<ins class="adsbygoogle">` element —
 * we exercise both halves: the allowlist gate and the slot markup.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicAdSlot from './PublicAdSlot';
import PublicAdSection from './PublicAdSection';

beforeEach(() => {
  // Ensure adsbygoogle is a benign array so the push doesn't blow up.
  (window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle = [];
});

function renderAt(path: string, node: React.ReactNode) {
  return render(<MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>);
}

describe('PublicAdSlot', () => {
  it('renders an adsbygoogle <ins> on an approved route', () => {
    const { container } = renderAt('/calculators/gauge', <PublicAdSlot slot="rowly-test" />);
    const ins = container.querySelector('ins.adsbygoogle');
    expect(ins).not.toBeNull();
    expect(ins?.getAttribute('data-ad-client')).toBe('ca-pub-9472587145183950');
    expect(ins?.getAttribute('data-ad-slot')).toBe('rowly-test');
  });

  it('renders nothing on the landing page', () => {
    const { container } = renderAt('/', <PublicAdSlot slot="rowly-test" />);
    expect(container.querySelector('ins.adsbygoogle')).toBeNull();
    expect(screen.queryByTestId('public-ad-slot')).toBeNull();
  });

  it('renders nothing on a logged-in app route (/dashboard)', () => {
    const { container } = renderAt('/dashboard', <PublicAdSlot slot="rowly-test" />);
    expect(container.querySelector('ins.adsbygoogle')).toBeNull();
  });

  it('renders nothing on /upgrade', () => {
    const { container } = renderAt('/upgrade', <PublicAdSlot slot="rowly-test" />);
    expect(container.querySelector('ins.adsbygoogle')).toBeNull();
  });

  it('renders nothing on /account/billing', () => {
    const { container } = renderAt('/account/billing', <PublicAdSlot slot="rowly-test" />);
    expect(container.querySelector('ins.adsbygoogle')).toBeNull();
  });

  it('renders nothing on /admin/business (founder tooling)', () => {
    const { container } = renderAt('/admin/business', <PublicAdSlot slot="rowly-test" />);
    expect(container.querySelector('ins.adsbygoogle')).toBeNull();
  });
});

describe('PublicAdSection', () => {
  it('wraps PublicAdSlot in a section with a "Sponsored" label on approved routes', () => {
    renderAt('/calculators', <PublicAdSection slot="rowly-test" testId="psa" />);
    expect(screen.getByText(/Sponsored/i)).toBeInTheDocument();
    expect(screen.getByTestId('psa')).toBeInTheDocument();
  });

  it('still renders nothing on the landing page', () => {
    const { container } = renderAt('/', <PublicAdSection slot="rowly-test" testId="psa" />);
    // Landing-page section shouldn't contain an ad <ins>.
    expect(container.querySelector('ins.adsbygoogle')).toBeNull();
  });
});
