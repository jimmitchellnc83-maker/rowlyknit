/**
 * Unit tests for requireSweepToken middleware.
 *
 * Does NOT depend on the database or Redis — purely env + header driven.
 */

import { Request, Response, NextFunction } from 'express';
import { requireSweepToken } from '../requireSweepToken';
import { ForbiddenError } from '../../utils/errorHandler';

function makeReq(authHeader?: string): Request {
  return {
    header: (name: string) =>
      name.toLowerCase() === 'authorization' ? authHeader : undefined,
  } as unknown as Request;
}

describe('requireSweepToken', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('rejects when GDPR_SWEEP_TOKEN is unset (fail-closed)', () => {
    delete process.env.GDPR_SWEEP_TOKEN;
    expect(() =>
      requireSweepToken(makeReq('Bearer anything'), {} as Response, jest.fn() as NextFunction),
    ).toThrow(ForbiddenError);
  });

  it('rejects when no Authorization header is present', () => {
    process.env.GDPR_SWEEP_TOKEN = 'secret';
    expect(() =>
      requireSweepToken(makeReq(undefined), {} as Response, jest.fn() as NextFunction),
    ).toThrow(ForbiddenError);
  });

  it('rejects a non-Bearer scheme', () => {
    process.env.GDPR_SWEEP_TOKEN = 'secret';
    expect(() =>
      requireSweepToken(makeReq('Basic secret'), {} as Response, jest.fn() as NextFunction),
    ).toThrow(ForbiddenError);
  });

  it('rejects a wrong token of equal length', () => {
    process.env.GDPR_SWEEP_TOKEN = 'abcdef';
    expect(() =>
      requireSweepToken(makeReq('Bearer abcxyz'), {} as Response, jest.fn() as NextFunction),
    ).toThrow(ForbiddenError);
  });

  it('rejects a token of different length without throwing on timingSafeEqual', () => {
    process.env.GDPR_SWEEP_TOKEN = 'long-secret-token';
    expect(() =>
      requireSweepToken(makeReq('Bearer short'), {} as Response, jest.fn() as NextFunction),
    ).toThrow(ForbiddenError);
  });

  it('passes the matching token through to next()', () => {
    process.env.GDPR_SWEEP_TOKEN = 'matching-secret';
    const next = jest.fn() as NextFunction;
    requireSweepToken(makeReq('Bearer matching-secret'), {} as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('accepts case-insensitive Bearer', () => {
    process.env.GDPR_SWEEP_TOKEN = 'matching-secret';
    const next = jest.fn() as NextFunction;
    requireSweepToken(makeReq('bearer matching-secret'), {} as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
