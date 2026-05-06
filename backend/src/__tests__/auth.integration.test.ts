/**
 * Integration tests for the /api/auth routes.
 *
 * PREREQUISITES:
 *   - A running PostgreSQL instance (defaults to localhost:5432, rowly_dev).
 *   - The database must be reachable and migrations will be applied automatically.
 *
 * These tests exercise the full HTTP stack via supertest against the Express app.
 */

// Set required env vars BEFORE any app imports so validateEnv / jwt.ts are happy.
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-different-from-jwt';
process.env.CSRF_SECRET = 'test-csrf-secret-value-at-least-32chars';
process.env.SESSION_SECRET = 'test-session-secret-at-least-32-chars!';
process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // not actually used by supertest but required by validateEnv
process.env.ALLOWED_ORIGINS = 'http://localhost:3000';

import request from 'supertest';
import app from '../app';
import testDb, { ensureMigrated } from './setup';

beforeAll(async () => {
  await ensureMigrated();
});

// ---------------------------------------------------------------------------
// Unique email per test run to avoid conflicts with existing data.
// ---------------------------------------------------------------------------
const TEST_EMAIL = `test-${Date.now()}@rowlyknit.test`;
const TEST_PASSWORD = 'StrongP@ss1!';
const TEST_FIRST_NAME = 'Test';
const TEST_LAST_NAME = 'User';

// Tokens populated during the test suite so later tests can use them.
let accessToken: string;
let refreshToken: string;

// ---------------------------------------------------------------------------
// Cleanup: remove the test user (and related sessions) after all tests.
// ---------------------------------------------------------------------------
afterAll(async () => {
  try {
    const user = await testDb('users').where({ email: TEST_EMAIL }).first();
    if (user) {
      await testDb('sessions').where({ user_id: user.id }).del();
      await testDb('audit_logs').where({ user_id: user.id }).del();
      await testDb('users').where({ id: user.id }).del();
    }
  } catch {
    // Best-effort cleanup; don't fail the suite.
  }
});

// ===========================================================================
// Registration
// ===========================================================================
describe('POST /api/auth/register', () => {
  it('should register a new user and return 201', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        firstName: TEST_FIRST_NAME,
        lastName: TEST_LAST_NAME,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe(TEST_EMAIL);
  });

  it('should return 422 for an invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'not-an-email',
        password: TEST_PASSWORD,
        firstName: 'Bad',
      });

    expect(res.status).toBe(422);
  });

  it('should return 422 for a password shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `short-pw-${Date.now()}@rowlyknit.test`,
        password: 'Ab1!',
        firstName: 'Short',
      });

    expect(res.status).toBe(422);
  });

  it('should return 409 for a duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        firstName: 'Dup',
      });

    expect(res.status).toBe(409);
  });
});

// ===========================================================================
// Login
// ===========================================================================
describe('POST /api/auth/login', () => {
  it('should login with correct credentials and return tokens', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // PR #389 final-pass P2: cookie-only auth — neither token is in the body.
    expect(res.body.data.accessToken).toBeUndefined();
    expect(res.body.data.refreshToken).toBeUndefined();
    expect(res.body.data.user.email).toBe(TEST_EMAIL);

    // Pull tokens out of the Set-Cookie response for the legacy bearer
    // assertions in tests further down. Each cookie comes back as a full
    // `name=value; Path=/; HttpOnly...` string.
    const cookies = (res.headers['set-cookie'] || []) as string[];
    const accessCookie = cookies.find((c) => c.startsWith('accessToken='));
    const refreshCookie = cookies.find((c) => c.startsWith('refreshToken='));
    expect(accessCookie).toBeDefined();
    expect(refreshCookie).toBeDefined();
    accessToken = accessCookie!.split(';')[0].split('=')[1];
    refreshToken = refreshCookie!.split(';')[0].split('=')[1];
  });

  it('should return 401 for a wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: TEST_EMAIL,
        password: 'WrongP@ss1!',
      });

    expect(res.status).toBe(401);
  });

  it('should return 401 for a non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: `no-one-${Date.now()}@rowlyknit.test`,
        password: TEST_PASSWORD,
      });

    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// Profile (GET)
// ===========================================================================
describe('GET /api/auth/profile', () => {
  it('should return the authenticated user profile', async () => {
    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(TEST_EMAIL);
    expect(res.body.data.user.firstName).toBe(TEST_FIRST_NAME);
    expect(res.body.data.user.lastName).toBe(TEST_LAST_NAME);
  });

  it('should return 401 when no token is provided', async () => {
    const res = await request(app).get('/api/auth/profile');

    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// Profile (PUT)
// ===========================================================================
describe('PUT /api/auth/profile', () => {
  it('should update firstName and lastName', async () => {
    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        firstName: 'Updated',
        lastName: 'Name',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.firstName).toBe('Updated');
    expect(res.body.data.user.lastName).toBe('Name');
  });
});

// ===========================================================================
// Change Password
// ===========================================================================
describe('PUT /api/auth/password', () => {
  const NEW_PASSWORD = 'NewStr0ng!Pass';

  it('should change the password successfully', async () => {
    const res = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: TEST_PASSWORD,
        newPassword: NEW_PASSWORD,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/password changed/i);
  });

  it('should fail with an incorrect current password', async () => {
    const res = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'TotallyWr0ng!',
        newPassword: 'AnotherP@ss1!',
      });

    expect(res.status).toBe(401);
  });

  // Restore original password so later tests still work.
  afterAll(async () => {
    await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: NEW_PASSWORD,
        newPassword: TEST_PASSWORD,
      });
  });
});

// ===========================================================================
// Refresh Token
// ===========================================================================
describe('POST /api/auth/refresh', () => {
  it('should rotate the access cookie without returning the token in the body', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // PR #389 final-pass P2: cookie-only refresh — body does not echo the token.
    expect(res.body.data.accessToken).toBeUndefined();

    const cookies = (res.headers['set-cookie'] || []) as string[];
    const accessCookie = cookies.find((c) => c.startsWith('accessToken='));
    expect(accessCookie).toBeDefined();
    const newAccessToken = accessCookie!.split(';')[0].split('=')[1];
    // The new access token should be different from the original one.
    expect(newAccessToken).not.toBe(accessToken);

    // Update stored token for any tests that might follow.
    accessToken = newAccessToken;
  });
});

// ===========================================================================
// Logout
// ===========================================================================
describe('POST /api/auth/logout', () => {
  it('should log the user out successfully', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/logout/i);
  });
});
