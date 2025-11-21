# Security Fixes - Recommended Implementation

## Issue 1: Password Reset Token Generation

**File:** `src/utils/jwt.ts` (Line 98)

### Current Code (Weak)
```typescript
export function generateResetToken(): string {
  return uuidv4() + uuidv4();  // Uses predictable UUIDs
}
```

### Problem
- UUIDs are not cryptographically secure for security tokens
- Uses UUID v4 which, while random, is designed for identification, not security
- Could be predictable with proper analysis

### Fixed Code
```typescript
import crypto from 'crypto';

export function generateResetToken(): string {
  // Generate 32 bytes (256 bits) of cryptographically secure random data
  // Convert to hex for URL-safe token (64 characters)
  return crypto.randomBytes(32).toString('hex');
}

// Alternative: Generate email verification token the same way
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
```

### Why This Works
- `crypto.randomBytes()` uses system CSPRNG (cryptographically secure)
- 32 bytes = 256 bits = very strong entropy
- Hex encoding produces 64 character token
- Same strength as CSRF tokens in your codebase

### Testing
```typescript
// Should produce different tokens each time
console.log(generateResetToken()); // e.g., "a3f8c2e9..."
console.log(generateResetToken()); // e.g., "7b4d1e2c..."

// Token should be exactly 64 characters
const token = generateResetToken();
console.assert(token.length === 64, 'Token should be 64 chars');
```

---

## Issue 2: JWT Verification in Rate Limiter

**File:** `src/middleware/rateLimiter.ts` (Lines 99-109)

### Current Code (Security Issue)
```typescript
if (!userId) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      // Quick decode of JWT payload (without verification, just for user ID)
      // PROBLEM: No signature verification!
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      userId = payload.userId;
    } catch (error) {
      // If token parsing fails, userId remains undefined
    }
  }
}
```

### Problem
- JWT decoded without verifying signature
- Attacker could submit tampered token with different userId
- Rate limit could be miscalculated per user
- While mitigated (falls back to IP), still a security issue

### Fixed Code - Option A (Recommended: Use verified token)
```typescript
if (!userId) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      // Verify token signature and expiration
      const payload = verifyAccessToken(token);
      userId = payload.userId;
    } catch (error) {
      // Token invalid or expired, fall back to IP
      logger.debug('Failed to verify token for rate limiting', { error: error.message });
    }
  }
}
```

### Fixed Code - Option B (Prefer auth middleware token)
```typescript
// Use the token already verified by auth middleware if available
let userId = (req as any).user?.userId;

// If no auth middleware has run, try to extract from header
// but still verify signature
if (!userId) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const payload = verifyAccessToken(token);
      userId = payload.userId;
    } catch (error) {
      // Log and continue (falls back to IP-based rate limiting)
      logger.debug('Rate limiter using unverified token fallback');
    }
  }
}
```

### Imports Required
```typescript
// At the top of rateLimiter.ts
import { verifyAccessToken } from '../utils/jwt';
```

### Testing
```typescript
// Tampered token should NOT be accepted
const validToken = generateAccessToken({ userId: 'user1', email: 'test@example.com' });
const tamperedToken = validToken.slice(0, -10) + 'deadbeef'; // Modify signature

// This should throw error
try {
  verifyAccessToken(tamperedToken);
  console.log('ERROR: Tampered token was accepted!');
} catch (error) {
  console.log('GOOD: Tampered token rejected:', error.message);
}
```

---

## Issue 3: Refresh Token Rotation

**File:** `src/routes/auth.ts` and `src/controllers/authController.ts`

### Current Code (No Rotation)
```typescript
router.post('/refresh', asyncHandler(authController.refreshToken));
// Refresh token can be reused indefinitely
```

### Problem
- Refresh tokens (7 days) can be used multiple times
- If token is compromised, attacker has 7 days to use it
- No way to revoke token after use
- Lost devices can't be logged out

### Fixed Code

**Step 1: Update Token Structure (authController.ts)**

```typescript
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { UnauthorizedError } from '../utils/errorHandler';

export async function refreshToken(req: Request, res: Response) {
  const refreshTokenFromRequest = req.body.refreshToken || req.cookies.refreshToken;
  
  if (!refreshTokenFromRequest) {
    throw new UnauthorizedError('No refresh token provided');
  }

  try {
    // Verify refresh token signature and expiration
    const payload = verifyRefreshToken(refreshTokenFromRequest);
    
    // Check token exists in database and isn't revoked
    const session = await db('sessions')
      .where({ 
        refresh_token: refreshTokenFromRequest,
        is_revoked: false,
        user_id: payload.userId
      })
      .whereRaw('expires_at > NOW()')
      .first();

    if (!session) {
      throw new UnauthorizedError('Refresh token invalid or revoked');
    }

    // Check user is still active
    const user = await db('users')
      .where({ id: payload.userId, is_active: true })
      .whereNull('deleted_at')
      .first();

    if (!user) {
      throw new UnauthorizedError('User not found or inactive');
    }

    // SECURITY: Invalidate old token immediately
    // This prevents token reuse attacks
    await db('sessions')
      .where({ id: session.id })
      .update({ 
        is_revoked: true,
        updated_at: new Date()
      });

    // Generate new token pair
    const newAccessToken = generateAccessToken({
      userId: user.id,
      email: user.email
    });

    const newRefreshToken = generateRefreshToken({
      userId: user.id,
      sessionId: session.id
    });

    // Store new refresh token in database
    const newSession = await db('sessions').insert({
      user_id: user.id,
      refresh_token: newRefreshToken,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      is_revoked: false,
      created_at: new Date(),
      updated_at: new Date()
    }).returning('*');

    // Audit log token refresh
    await createAuditLog(req, {
      userId: user.id,
      action: 'refresh_token',
      entityType: 'session',
      entityId: newSession[0].id,
      metadata: {
        oldSessionId: session.id,
        newSessionId: newSession[0].id
      }
    });

    // Set refresh token as secure cookie (optional)
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 15 * 60 // 15 minutes in seconds
      }
    });

  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    throw new UnauthorizedError('Failed to refresh token');
  }
}
```

**Step 2: Logout Should Also Revoke Token (authController.ts)**

```typescript
export async function logout(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const refreshToken = req.body.refreshToken || req.cookies.refreshToken;

  if (refreshToken) {
    try {
      // Invalidate refresh token
      await db('sessions')
        .where({ 
          refresh_token: refreshToken,
          user_id: userId
        })
        .update({ 
          is_revoked: true,
          updated_at: new Date()
        });

      // Audit log logout
      await createAuditLog(req, {
        userId,
        action: 'logout',
        entityType: 'session',
        metadata: { refreshToken: refreshToken.substring(0, 10) + '...' }
      });
    } catch (error) {
      logger.error('Failed to revoke refresh token on logout', { error });
      // Continue even if revocation fails
    }
  }

  // Clear cookies
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}
```

### Database Changes Required

The `sessions` table already has these columns, so no migration needed:
- `is_revoked` - Already exists (boolean)
- `expires_at` - Already exists (timestamp)
- `refresh_token` - Already exists (unique string)

### Testing
```typescript
// Test refresh token rotation
const user = await db('users').first();
const { accessToken, refreshToken } = await login(user);

// First refresh should work
const refresh1 = await refreshToken(refreshToken);
const newToken1 = refresh1.refreshToken;

// Old token should be revoked
const oldSession = await db('sessions')
  .where({ refresh_token: refreshToken })
  .first();
expect(oldSession.is_revoked).toBe(true);

// Can't use old token again
await expect(refreshToken(refreshToken)).rejects.toThrow('Refresh token invalid');

// But new token works
const refresh2 = await refreshToken(newToken1);
expect(refresh2.accessToken).toBeDefined();
```

---

## Issue 4: CORS Origin Validation

**File:** `src/app.ts` (Line 75)

### Current Code (Too Permissive)
```typescript
const corsOptions = {
  origin: (origin: string | undefined, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);  // PROBLEM: Too permissive

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from unauthorized origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  // ...
};
```

### Problem
- Allows requests with no Origin header
- Could bypass CORS restrictions in some attack scenarios
- While mitigated by CSRF and auth, could be tighter

### Fixed Code
```typescript
const corsOptions = {
  origin: (origin: string | undefined, callback) => {
    // In development, allow no origin (mobile apps, Postman)
    // In production, require valid origin
    if (!origin) {
      if (process.env.NODE_ENV === 'production') {
        return callback(new Error('Origin required'));
      }
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from unauthorized origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
};
```

### Alternative: Even More Restrictive
```typescript
// Never allow empty origin in production
const corsOptions = {
  origin: (origin: string | undefined, callback) => {
    // Reject if no origin in production
    if (!origin && process.env.NODE_ENV === 'production') {
      return callback(new Error('Origin required in production'));
    }

    // Reject if origin not in whitelist
    if (origin && !allowedOrigins.includes(origin)) {
      logger.warn(`CORS blocked: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    }

    // Allow if:
    // - No origin + development
    // - Origin in whitelist
    callback(null, true);
  },
  credentials: true,
  optionsSuccessStatus: 200
};
```

---

## Implementation Priority

### Immediate (Week 1)
1. Fix password reset token generation (Issue 1)
2. Add JWT verification to rate limiter (Issue 2)

### Short-term (Week 2-3)
3. Implement refresh token rotation (Issue 3)
4. Improve CORS configuration (Issue 4)

### Medium-term (Month 1)
5. Add token blacklist/revocation cache
6. Implement IP-based brute force detection

---

## Testing Checklist

After implementing each fix:

- [ ] Password reset tokens are unpredictable
- [ ] Rate limiter rejects tampered JWTs
- [ ] Refresh token can only be used once
- [ ] Old refresh token rejected after rotation
- [ ] CORS rejects invalid origins in production
- [ ] Auth still works with valid credentials
- [ ] Audit logs show security actions
- [ ] No performance degradation

---

## Related Files to Review

After implementing these fixes, also consider:

1. **Token Revocation Cache** - `src/middleware/auth.ts`
   - Check JTI against Redis blacklist for immediate logout

2. **Brute Force Detection** - `src/middleware/rateLimiter.ts`
   - Track failed logins by IP
   - Lock account after N failures

3. **Two-Factor Authentication** - `src/migrations/`
   - Add `totp_secret` to users table
   - Implement TOTP verification

---

**All fixes maintain backward compatibility** and don't require database migrations (except optional 2FA).

