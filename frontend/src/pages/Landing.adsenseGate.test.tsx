/**
 * Landing-page ad gate.
 *
 * Policy: the landing page must NEVER render an ad slot. This test pins
 * that contract — if a future commit drops `<PublicAdSlot />` into
 * Landing the route allowlist will block rendering, but we also assert
 * here that the rendered DOM contains no `ins.adsbygoogle` so a
 * regression is caught at PR time.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Landing from './Landing';

describe('Landing page — AdSense policy', () => {
  it('renders no ad slot markup at /', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <Landing />
      </MemoryRouter>,
    );
    expect(container.querySelectorAll('ins.adsbygoogle').length).toBe(0);
    expect(container.querySelectorAll('[data-testid="public-ad-slot"]').length).toBe(0);
  });
});
