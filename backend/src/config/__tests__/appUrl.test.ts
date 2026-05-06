/**
 * PR #389 P1 closure — APP_URL fail-loud tests.
 *
 * The Codex review flagged that `process.env.APP_URL` was read with
 * silent fallbacks across four call sites (auth controller, GDPR
 * service, chart sharing service, billing config). A misconfigured
 * production deploy would emit `http://localhost:5173/...` URLs in
 * verification emails, reset links, share URLs, and checkout
 * redirects — broken for the user, no log signal.
 *
 * The fix consolidates the read into `getAppUrl()`. This file pins
 * its behaviour:
 *
 *   - Production + missing APP_URL → throws.
 *   - Production + invalid (non-http) APP_URL → throws.
 *   - Production + valid APP_URL → returns the value, trailing slash
 *     stripped.
 *   - Non-production + missing → returns dev fallback with warn.
 *   - Non-production + invalid → returns dev fallback with warn.
 *   - `assertAppUrlValid` is a no-op in non-production (so the test
 *     suite itself doesn't need a real APP_URL).
 *   - `assertAppUrlValid` throws in production with the same messages.
 */

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_APP_URL = process.env.APP_URL;

const mockLogger = {
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../logger', () => ({ default: mockLogger, __esModule: true }));

import { getAppUrl, assertAppUrlValid, __resetAppUrlWarnedForTests } from '../appUrl';

beforeEach(() => {
  mockLogger.warn.mockClear();
  __resetAppUrlWarnedForTests();
});

afterEach(() => {
  if (ORIGINAL_NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  if (ORIGINAL_APP_URL === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = ORIGINAL_APP_URL;
});

describe('getAppUrl — production fail-loud', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'production';
  });

  it('throws when APP_URL is unset', () => {
    delete process.env.APP_URL;
    expect(() => getAppUrl()).toThrow(/APP_URL is unset/i);
    expect(() => getAppUrl()).toThrow(/Production cannot fall back to localhost/i);
  });

  it('throws when APP_URL is empty string', () => {
    process.env.APP_URL = '';
    expect(() => getAppUrl()).toThrow(/APP_URL is unset/i);
  });

  it('throws when APP_URL is whitespace only', () => {
    process.env.APP_URL = '   ';
    expect(() => getAppUrl()).toThrow(/APP_URL is unset/i);
  });

  it('throws when APP_URL is not a valid http(s) URL', () => {
    process.env.APP_URL = 'not-a-url';
    expect(() => getAppUrl()).toThrow(/not a valid http\(s\) URL/i);
  });

  it('throws when APP_URL uses an unsafe scheme (file://, javascript:)', () => {
    process.env.APP_URL = 'file:///tmp/x';
    expect(() => getAppUrl()).toThrow(/not a valid http\(s\) URL/i);

    process.env.APP_URL = 'javascript:alert(1)';
    expect(() => getAppUrl()).toThrow(/not a valid http\(s\) URL/i);
  });

  it('returns a valid https APP_URL with trailing slash stripped', () => {
    process.env.APP_URL = 'https://rowlyknit.com/';
    expect(getAppUrl()).toBe('https://rowlyknit.com');
  });

  it('accepts http URLs (not just https) for staging hosts', () => {
    process.env.APP_URL = 'http://staging.rowlyknit.com';
    expect(getAppUrl()).toBe('http://staging.rowlyknit.com');
  });
});

describe('getAppUrl — non-production fallback', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
  });

  it('returns the dev fallback when unset and warns once', () => {
    delete process.env.APP_URL;
    expect(getAppUrl()).toBe('http://localhost:5173');
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn.mock.calls[0][0]).toMatch(/APP_URL is not set or invalid/);
  });

  it('does not double-warn on repeated calls', () => {
    delete process.env.APP_URL;
    getAppUrl();
    getAppUrl();
    getAppUrl();
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
  });

  it('returns the dev fallback when invalid', () => {
    process.env.APP_URL = 'not-a-url';
    expect(getAppUrl()).toBe('http://localhost:5173');
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
  });

  it('uses a valid value when supplied', () => {
    process.env.APP_URL = 'http://localhost:3000';
    expect(getAppUrl()).toBe('http://localhost:3000');
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('strips trailing slash on valid dev URLs', () => {
    process.env.APP_URL = 'http://localhost:5173/';
    expect(getAppUrl()).toBe('http://localhost:5173');
  });
});

describe('getAppUrl — test environment treated as non-production', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
  });

  it('falls back without throwing when APP_URL is unset', () => {
    delete process.env.APP_URL;
    expect(() => getAppUrl()).not.toThrow();
    expect(getAppUrl()).toBe('http://localhost:5173');
  });
});

describe('assertAppUrlValid — boot-time guard', () => {
  it('is a no-op in non-production even when APP_URL is missing', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.APP_URL;
    expect(() => assertAppUrlValid()).not.toThrow();
  });

  it('is a no-op in test even when APP_URL is missing', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.APP_URL;
    expect(() => assertAppUrlValid()).not.toThrow();
  });

  it('throws in production when APP_URL is missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.APP_URL;
    expect(() => assertAppUrlValid()).toThrow(/APP_URL is unset/i);
  });

  it('throws in production when APP_URL is invalid', () => {
    process.env.NODE_ENV = 'production';
    process.env.APP_URL = 'ftp://wrong-scheme.test';
    expect(() => assertAppUrlValid()).toThrow(/not a valid http\(s\) URL/i);
  });

  it('does NOT throw in production when APP_URL is valid', () => {
    process.env.NODE_ENV = 'production';
    process.env.APP_URL = 'https://rowlyknit.com';
    expect(() => assertAppUrlValid()).not.toThrow();
  });
});
