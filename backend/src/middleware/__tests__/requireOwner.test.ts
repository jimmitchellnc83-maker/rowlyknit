/**
 * Unit tests for requireOwner middleware.
 *
 * Does NOT depend on the database or Redis — purely env-driven.
 */

import { Request, Response, NextFunction } from 'express';
import { requireOwner } from '../requireOwner';
import { ForbiddenError } from '../../utils/errorHandler';

function makeReq(email?: string): Request {
  return {
    user: email ? { userId: 'u1', email } : undefined,
  } as unknown as Request;
}

describe('requireOwner', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('rejects when OWNER_EMAIL is unset (fail-closed)', () => {
    delete process.env.OWNER_EMAIL;
    expect(() => requireOwner(makeReq('any@example.com'), {} as Response, jest.fn() as NextFunction))
      .toThrow(ForbiddenError);
  });

  it('rejects an authenticated non-owner', () => {
    process.env.OWNER_EMAIL = 'owner@example.com';
    expect(() => requireOwner(makeReq('rando@example.com'), {} as Response, jest.fn() as NextFunction))
      .toThrow(ForbiddenError);
  });

  it('rejects an unauthenticated request', () => {
    process.env.OWNER_EMAIL = 'owner@example.com';
    expect(() => requireOwner(makeReq(undefined), {} as Response, jest.fn() as NextFunction))
      .toThrow(ForbiddenError);
  });

  it('allows the configured owner', () => {
    process.env.OWNER_EMAIL = 'owner@example.com';
    const next = jest.fn() as NextFunction;
    requireOwner(makeReq('owner@example.com'), {} as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('allows any email in a comma-separated allowlist', () => {
    process.env.OWNER_EMAIL = 'a@example.com, b@example.com,c@example.com';
    const next = jest.fn() as NextFunction;
    requireOwner(makeReq('b@example.com'), {} as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('matches case-insensitively', () => {
    process.env.OWNER_EMAIL = 'Owner@Example.com';
    const next = jest.fn() as NextFunction;
    requireOwner(makeReq('OWNER@example.COM'), {} as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
