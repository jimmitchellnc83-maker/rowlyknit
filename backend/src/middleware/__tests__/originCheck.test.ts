/**
 * Unit tests for requireSameOrigin middleware.
 *
 * Does NOT depend on the database or Redis — only imports the middleware
 * and a mocked logger. Runs standalone under `npx jest src/middleware/__tests__`.
 */

jest.mock('../../config/logger', () => ({
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
  __esModule: true,
}));

import { Request, Response, NextFunction } from 'express';
import { requireSameOrigin } from '../originCheck';
import { ForbiddenError } from '../../utils/errorHandler';

function makeReq(overrides: { origin?: string; referer?: string } = {}): Request {
  const headers: Record<string, string> = {};
  if (overrides.origin) headers.origin = overrides.origin;
  if (overrides.referer) headers.referer = overrides.referer;
  return {
    get(name: string) {
      return headers[name.toLowerCase()];
    },
    ip: '127.0.0.1',
    path: '/api/auth/login',
    method: 'POST',
  } as unknown as Request;
}

describe('requireSameOrigin', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('rejects when ALLOWED_ORIGINS is empty (fail-closed)', () => {
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.CORS_ORIGIN;
    const next = jest.fn() as unknown as NextFunction;
    requireSameOrigin(makeReq({ origin: 'https://rowlyknit.com' }), {} as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    const arg = (next as unknown as jest.Mock).mock.calls[0][0];
    expect(arg).toBeInstanceOf(ForbiddenError);
    expect(arg.message).toBe('Server origin allowlist not configured');
  });

  it('rejects when both Origin and Referer are missing', () => {
    process.env.ALLOWED_ORIGINS = 'https://rowlyknit.com';
    const next = jest.fn() as unknown as NextFunction;
    requireSameOrigin(makeReq(), {} as Response, next);
    const arg = (next as unknown as jest.Mock).mock.calls[0][0];
    expect(arg).toBeInstanceOf(ForbiddenError);
    expect(arg.message).toBe('Missing Origin header');
  });

  it('accepts a matching Origin', () => {
    process.env.ALLOWED_ORIGINS = 'https://rowlyknit.com';
    const next = jest.fn() as unknown as NextFunction;
    requireSameOrigin(makeReq({ origin: 'https://rowlyknit.com' }), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects a mismatched Origin', () => {
    process.env.ALLOWED_ORIGINS = 'https://rowlyknit.com';
    const next = jest.fn() as unknown as NextFunction;
    requireSameOrigin(makeReq({ origin: 'https://evil.com' }), {} as Response, next);
    const arg = (next as unknown as jest.Mock).mock.calls[0][0];
    expect(arg).toBeInstanceOf(ForbiddenError);
    expect(arg.message).toBe('Origin not allowed');
  });

  it('accepts a matching Referer when Origin is absent', () => {
    process.env.ALLOWED_ORIGINS = 'https://rowlyknit.com';
    const next = jest.fn() as unknown as NextFunction;
    requireSameOrigin(
      makeReq({ referer: 'https://rowlyknit.com/login?redirect=%2Fdashboard' }),
      {} as Response,
      next
    );
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects a Referer that only *starts* like an allowed origin', () => {
    process.env.ALLOWED_ORIGINS = 'https://rowlyknit.com';
    const next = jest.fn() as unknown as NextFunction;
    // https://rowlyknit.com.evil.com must not be accepted just because it starts with the allowed string.
    requireSameOrigin(
      makeReq({ referer: 'https://rowlyknit.com.evil.com/login' }),
      {} as Response,
      next
    );
    const arg = (next as unknown as jest.Mock).mock.calls[0][0];
    expect(arg).toBeInstanceOf(ForbiddenError);
  });

  it('accepts when multiple origins are configured and one matches', () => {
    process.env.ALLOWED_ORIGINS = 'https://rowlyknit.com,https://staging.rowlyknit.com';
    const next = jest.fn() as unknown as NextFunction;
    requireSameOrigin(makeReq({ origin: 'https://staging.rowlyknit.com' }), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('falls back to CORS_ORIGIN env var if ALLOWED_ORIGINS is unset', () => {
    delete process.env.ALLOWED_ORIGINS;
    process.env.CORS_ORIGIN = 'https://rowlyknit.com';
    const next = jest.fn() as unknown as NextFunction;
    requireSameOrigin(makeReq({ origin: 'https://rowlyknit.com' }), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });
});
