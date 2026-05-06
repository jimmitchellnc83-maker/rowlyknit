/**
 * Verify that `trackEvent` fires the first-party POST to
 * `/shared/analytics/event` for events on the dashboard allowlist, and
 * does NOT fire for events outside the allowlist.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  trackEvent,
  __ROWLY_FIRST_PARTY_EVENTS_FOR_TESTS,
} from '../analytics';

const sendBeacon = vi.fn<(url: string, data?: BodyInit | null) => boolean>(() => true);
const fetchSpy = vi.fn<(url: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
  () => Promise.resolve({} as Response),
);

beforeEach(() => {
  sendBeacon.mockReset().mockReturnValue(true);
  fetchSpy.mockReset().mockResolvedValue({} as Response);
  // Install spy on navigator.sendBeacon (the test setup already stubs
  // it with a default no-op; we override here so we can observe calls).
  Object.defineProperty(window.navigator, 'sendBeacon', {
    configurable: true,
    writable: true,
    value: sendBeacon,
  });
  vi.stubGlobal('fetch', fetchSpy);
  // Plausible isn't loaded by default — clears any prior trackEvent path.
  delete (window as any).plausible;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('trackEvent first-party POSTs', () => {
  it('fires sendBeacon to /shared/analytics/event for an allowlisted event', () => {
    trackEvent('public_tool_viewed', { route: '/calculators/gauge' });
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [url, blob] = sendBeacon.mock.calls[0];
    expect(url).toMatch(/\/shared\/analytics\/event$/);
    // Blob — sendBeacon gets a Blob containing the JSON.
    expect(blob).toBeInstanceOf(Blob);
  });

  it('does NOT fire for an event outside the allowlist', () => {
    trackEvent('arbitrary_internal_event');
    expect(sendBeacon).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls back to fetch when sendBeacon fails', () => {
    sendBeacon.mockReturnValue(false);
    trackEvent('public_tool_used', { route: '/calculators/gauge', toolId: 'gauge' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/shared\/analytics\/event$/);
    expect(init.method).toBe('POST');
    expect((init.headers as any)['Content-Type']).toBe('application/json');
    expect(init.keepalive).toBe(true);
    const body = JSON.parse(init.body as string);
    expect(body.eventName).toBe('public_tool_used');
    expect(body.metadata.route).toBe('/calculators/gauge');
  });

  it('exposes the dashboard funnel events in the FE allowlist', () => {
    expect(__ROWLY_FIRST_PARTY_EVENTS_FOR_TESTS.has('public_tool_viewed')).toBe(true);
    expect(__ROWLY_FIRST_PARTY_EVENTS_FOR_TESTS.has('public_tool_used')).toBe(true);
    expect(__ROWLY_FIRST_PARTY_EVENTS_FOR_TESTS.has('save_to_rowly_clicked')).toBe(true);
    expect(__ROWLY_FIRST_PARTY_EVENTS_FOR_TESTS.has('upgrade_page_viewed')).toBe(true);
    expect(__ROWLY_FIRST_PARTY_EVENTS_FOR_TESTS.has('checkout_started')).toBe(true);
    expect(__ROWLY_FIRST_PARTY_EVENTS_FOR_TESTS.has('checkout_completed')).toBe(true);
  });
});
