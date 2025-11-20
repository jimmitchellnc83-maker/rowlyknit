# Security Audit Report - November 2025 (Updated)
**Date:** 2025-11-17
**Auditor:** Claude Code
**Branch:** claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy
**Previous Audit:** SECURITY_AUDIT_2025.md

---

## Executive Summary

This is an updated comprehensive security audit conducted to verify fixes from the previous audit and identify remaining vulnerabilities. The audit examined authentication, authorization, input validation, CORS, CSRF protection, and common web vulnerabilities.

**Overall Security Score: 6.5/10** (Down from 7.5/10 - Critical issues remain unresolved)

**Previous Critical Issues Status:**
- ✅ **FIXED:** WebSocket authorization now includes ownership verification
- ❌ **NOT FIXED:** Mass assignment vulnerabilities still present (CRITICAL)
- ❌ **NOT FIXED:** Missing required environment variables (CRITICAL)

**Current Status:**
- **Critical Issues:** 2 (UNCHANGED)
- **High Priority Issues:** 4 (Increased from 3)
- **Medium Priority Issues:** 5 (UNCHANGED)
- **Low Priority Issues:** 4 (UNCHANGED)

---

## 🔴 CRITICAL VULNERABILITIES (Immediate Action Required)

### 1. Mass Assignment Vulnerability - STILL PRESENT ❌
**Severity:** CRITICAL
**Status:** NOT FIXED
**Impact:** Attackers can modify arbitrary database fields including user_id, deleted_at, created_at

**Affected Files:**
- `backend/src/controllers/projectsController.ts:170`
- `backend/src/controllers/patternsController.ts:197`
- `backend/src/controllers/yarnController.ts:155`
- `backend/src/controllers/recipientsController.ts:139`
- `backend/src/controllers/toolsController.ts:137`

**Current Vulnerable Code:**
```typescript
const [updatedProject] = await db('projects')
  .where({ id })
  .update({
    ...updates,  // ❌ STILL VULNERABLE - accepts any field
    updated_at: new Date(),
  })
  .returning('*');
```

**Attack Scenario:**
```javascript
// Attacker sends:
PUT /api/projects/123
{
  "name": "My Project",
  "user_id": "attacker-user-id",  // Can steal the project!
  "deleted_at": null,
  "is_admin": true,
  "created_at": "2020-01-01"
}
```

**Required Fix:**
```typescript
// Create whitelist for each controller
const allowedFields = ['name', 'description', 'status', 'notes', 'start_date', 'end_date'];
const sanitizedUpdates = Object.keys(updates)
  .filter(key => allowedFields.includes(key))
  .reduce((obj, key) => ({ ...obj, [key]: updates[key] }), {});

const [updatedProject] = await db('projects')
  .where({ id, user_id: req.user.userId })
  .update({
    ...sanitizedUpdates,
    updated_at: new Date(),
  })
  .returning('*');
```

**Priority:** Fix IMMEDIATELY before production deployment
**Risk:** HIGH - Can lead to privilege escalation and data theft

---

### 2. Missing Required Environment Variables - STILL PRESENT ❌
**Severity:** CRITICAL
**Status:** NOT FIXED
**Impact:** Application will fail to start in production

**Missing Variables in `backend/.env`:**
- ✅ `JWT_SECRET` - Present
- ❌ `JWT_REFRESH_SECRET` - MISSING (Required by utils/jwt.ts:14)
- ❌ `CSRF_SECRET` - MISSING (Required by app.ts:95-98)

**Current Status:**
- Code has validation that throws error on startup if missing
- Production environment will crash on container start with:
  ```
  Error: Missing required environment variable: JWT_REFRESH_SECRET
  Error: Missing required environment variable: CSRF_SECRET
  ```

**Required Fix:**
Add to `backend/.env`:
```bash
# CSRF Protection
CSRF_SECRET=<generate 64-character random string>

# JWT Refresh Token Secret (MUST be different from JWT_SECRET)
JWT_REFRESH_SECRET=<generate 64-character random string different from JWT_SECRET>
```

**Generate Secrets:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Priority:** Add before next deployment
**Risk:** CRITICAL - Application will not start

---

## 🟠 HIGH PRIORITY ISSUES

### 3. WebSocket Authorization - FIXED ✅
**Severity:** HIGH
**Status:** FIXED
**File:** `backend/src/config/socket.ts:50-67`

**Fixed Code:**
```typescript
socket.on('join:project', async (projectId: string) => {
  try {
    // Verify user owns this project
    const project = await db('projects')
      .where({ id: projectId, user_id: userId, deleted_at: null })
      .first();

    if (project) {
      socket.join(`project:${projectId}`);
      logger.info(`User ${userId} joined project room: ${projectId}`);
    } else {
      logger.warn(`User ${userId} denied access to project room: ${projectId}`);
      socket.emit('error', { message: 'Access denied to project room' });
    }
  } catch (err) {
    logger.error(`Error joining project room: ${err}`);
    socket.emit('error', { message: 'Failed to join project room' });
  }
});
```

**Status:** ✅ Excellent implementation with proper error handling

---

### 4. JWT Secret Validation Missing - NOT FIXED ❌
**Severity:** HIGH
**Status:** NOT FIXED
**Impact:** If JWT_SECRET === JWT_REFRESH_SECRET, token separation is compromised
**File:** `backend/src/utils/jwt.ts:13-14`

**Current Code:**
```typescript
const JWT_SECRET = getRequiredEnv('JWT_SECRET');
const JWT_REFRESH_SECRET = getRequiredEnv('JWT_REFRESH_SECRET');
// No validation that they're different!
```

**Required Fix:**
```typescript
const JWT_SECRET = getRequiredEnv('JWT_SECRET');
const JWT_REFRESH_SECRET = getRequiredEnv('JWT_REFRESH_SECRET');

// Ensure secrets are different
if (JWT_SECRET === JWT_REFRESH_SECRET) {
  throw new Error('Security Error: JWT_SECRET and JWT_REFRESH_SECRET must be different values!');
}
```

**Priority:** HIGH
**Risk:** Token security compromised if secrets are identical

---

### 5. Content-Disposition Header Injection - STILL PRESENT ❌
**Severity:** HIGH (Upgraded from MEDIUM)
**Status:** NOT FIXED
**File:** `backend/src/controllers/uploadsController.ts:523, 525`

**Vulnerable Code:**
```typescript
res.setHeader('Content-Disposition', `inline; filename="${file.original_filename}"`);
```

**Attack Scenario:**
User uploads file named: `malicious";response-header="evil.pdf`

**Required Fix:**
```typescript
const escapedFilename = file.original_filename.replace(/"/g, '\\"').replace(/[\r\n]/g, '');
res.setHeader('Content-Disposition', `inline; filename="${escapedFilename}"`);
```

**Priority:** HIGH
**Risk:** Response header injection attacks

---

### 6. Cookie SameSite Inconsistency - STILL PRESENT ❌
**Severity:** HIGH (Upgraded from MEDIUM)
**Status:** NOT FIXED
**Files:**
- `backend/src/controllers/authController.ts:163` (login uses 'lax')
- `backend/src/controllers/authController.ts:249` (refresh uses 'strict')

**Inconsistent Code:**
```typescript
// Login - uses 'lax'
res.cookie('accessToken', accessToken, {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,  // Line 163
  maxAge: 15 * 60 * 1000,
});

// Token refresh - uses 'strict'
res.cookie('accessToken', accessToken, {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict',  // Line 249 - INCONSISTENT!
  maxAge: 15 * 60 * 1000,
});
```

**Impact:** Inconsistent behavior could break token refresh flows

**Required Fix:**
```typescript
// Use 'lax' consistently for all auth cookies
const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,  // Consistent across all auth endpoints
};
```

**Priority:** HIGH
**Risk:** Authentication flow may break unexpectedly

---

## 🟡 MEDIUM PRIORITY ISSUES

### 7. CSRF Protection Complexity
**Severity:** MEDIUM
**Status:** ACCEPTABLE
**File:** `backend/src/middleware/csrf.ts`

**Issue:** App uses both JWT (in headers) AND cookies for authentication

**Current State:** Both are used, which is not wrong but increases attack surface
**Recommendation:** Choose one authentication method (JWT OR cookies)

---

### 8. File Path Injection Potential
**Severity:** MEDIUM
**Status:** LIKELY SAFE
**File:** `backend/src/controllers/uploadsController.ts:505`

**Code:**
```typescript
const filepath = path.join('uploads/patterns', file.filename);
```

**Status:** Likely safe - filename is generated by the app, not user-controlled

**Recommended Fix (defense in depth):**
```typescript
const sanitizedFilename = path.basename(file.filename);
const filepath = path.join('uploads/patterns', sanitizedFilename);
```

---

### 9. Error Stack Traces in Production
**Severity:** MEDIUM
**Status:** GOOD (Minor improvement needed)
**File:** `backend/src/utils/errorHandler.ts:96`

**Current Code:**
```typescript
...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
```

**Recommended Improvement:**
```typescript
...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
```

**Status:** Current implementation is acceptable

---

### 10. SQL Injection in Search Queries
**Severity:** MEDIUM (Low likelihood)
**Status:** LIKELY SAFE
**Files:**
- `backend/src/controllers/projectsController.ts`
- `backend/src/controllers/patternsController.ts`
- `backend/src/controllers/yarnController.ts`

**Code:**
```typescript
.where('name', 'ilike', `%${search}%`)
```

**Status:** Safe due to Knex.js parameterization, but input is already sanitized by validator.escape()

---

### 11. Potential SQL Injection in db.raw() - VERIFIED SAFE ✅
**Severity:** MEDIUM
**Status:** SAFE
**Impact:** All db.raw() calls use safe aggregate functions

**Verified Safe Usages:**
```typescript
// All are aggregate functions, no user input
db.raw('COUNT(*) as total_count')
db.raw("COUNT(*) FILTER (WHERE status = 'active') as active_count")
db.raw('SUM(yards_remaining) as total_yards')
```

**Status:** ✅ No SQL injection risk found

---

## 🟢 LOW PRIORITY ISSUES

### 12. Rate Limiting Key Fallback
**Severity:** LOW
**Status:** ACCEPTABLE
**File:** `backend/src/middleware/rateLimiter.ts:22, 47, 68`

**Code:**
```typescript
return (req as any).user?.userId || req.ip || 'unknown';
```

**Issue:** Falls back to 'unknown' if IP is not available

**Recommendation:**
```typescript
const key = (req as any).user?.userId || req.ip;
if (!key) {
  throw new Error('Cannot identify request source for rate limiting');
}
return key;
```

---

### 13. Bcrypt Rounds Configurable
**Severity:** LOW
**Status:** ACCEPTABLE
**File:** `backend/src/utils/password.ts:3`

**Code:**
```typescript
const SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');
```

**Issue:** Could be set to weak value like '4'

**Recommendation:**
```typescript
const SALT_ROUNDS = Math.max(12, parseInt(process.env.BCRYPT_ROUNDS || '12'));
```

---

### 14. JWT Algorithm Not Specified - STILL PRESENT ❌
**Severity:** LOW
**Status:** NOT FIXED
**File:** `backend/src/utils/jwt.ts:34-38`

**Vulnerable Code:**
```typescript
return jwt.sign(
  { ...payload, jti: uuidv4() },
  JWT_SECRET,
  { expiresIn: JWT_EXPIRY } // No algorithm specified!
);
```

**Issue:** Vulnerable to algorithm confusion attacks

**Required Fix:**
```typescript
return jwt.sign(
  { ...payload, jti: uuidv4() },
  JWT_SECRET,
  { expiresIn: JWT_EXPIRY, algorithm: 'HS256' }
);
```

---

### 15. Password Reset Token Weak Randomness - STILL PRESENT ❌
**Severity:** LOW
**Status:** NOT FIXED
**File:** `backend/src/utils/jwt.ts:91-92`

**Code:**
```typescript
export function generateResetToken(): string {
  return uuidv4() + uuidv4(); // UUID is not cryptographically strong for this purpose
}
```

**Recommendation:**
```typescript
import crypto from 'crypto';
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
```

---

## ✅ EXCELLENT SECURITY PRACTICES FOUND

The following security measures are correctly implemented:

1. **Password Hashing** ✅
   - Using bcrypt with 12 rounds (strong)
   - Password strength validation enforced
   - Passwords never logged or exposed

2. **Input Sanitization** ✅
   - Global sanitization middleware using validator.escape()
   - Applied to body, query, and params
   - Recursive sanitization for nested objects
   - File: `backend/src/middleware/validator.ts`

3. **Authentication** ✅
   - JWT tokens properly implemented
   - Token expiration enforced
   - Sessions properly managed with revocation support
   - User verification checks active status and soft deletes
   - File: `backend/src/middleware/auth.ts`

4. **Authorization** ✅
   - All routes protected with authentication middleware
   - User ownership verified before operations (14 controllers)
   - UUID validation on all ID parameters

5. **Rate Limiting** ✅
   - Implemented with Redis backing
   - Different limits for different endpoints (general, auth, upload)
   - IP-based and user-based rate limiting
   - Skip successful login attempts

6. **Security Headers** ✅
   - Helmet middleware with CSP
   - HSTS enabled with 1-year max-age
   - Secure cookies in production

7. **CORS** ✅
   - Properly configured with specific origins
   - Credentials enabled correctly
   - Environment-based configuration

8. **File Upload Security** ✅
   - MIME type validation
   - File size limits enforced (10MB images, 25MB patterns, 10MB audio)
   - Files processed with Sharp (safe image processing)
   - Ownership verification before file operations
   - Separate upload dirs for different file types

9. **XSS Protection** ✅
   - No dangerouslySetInnerHTML found in React code
   - React's built-in escaping utilized
   - Input sanitization applied globally

10. **Secrets Management** ✅
    - .env files properly gitignored
    - No hardcoded secrets in code
    - Environment variables validated at startup

11. **SQL Injection Protection** ✅
    - Using Knex.js query builder (parameterized)
    - All db.raw() calls use safe aggregate functions
    - No string concatenation in queries

12. **Audit Logging** ✅
    - All significant actions logged
    - IP address and user tracked
    - Old/new values recorded for updates

13. **WebSocket Security** ✅ (NEW)
    - Ownership verification on room joins
    - Proper error handling
    - Logging of access attempts

---

## Environment Variable Audit

### Properly Secured ✅
- .env files in .gitignore
- Only .example files tracked in git
- No .env files in git history
- Secrets not hardcoded in code

### Present in .env ✅
- `JWT_SECRET`
- `SESSION_SECRET`
- `DB_PASSWORD`
- `REDIS_PASSWORD`
- All database and infrastructure configs

### Missing Required Variables ❌
**Backend .env is missing:**
- ❌ `CSRF_SECRET` (required by app.ts:95-98)
- ❌ `JWT_REFRESH_SECRET` (required by utils/jwt.ts:14)

**These must be added before production deployment!**

---

## Dependency Vulnerabilities

**Status:** Moderate vulnerabilities in Jest (devDependency only)
- ⚠️ Multiple moderate severity issues in @jest/* packages
- ✅ Not critical for production (testing library only)
- ✅ Vulnerabilities are in test infrastructure, not runtime
- Recommendation: Update Jest to latest version when convenient

**Production Dependencies:** No critical vulnerabilities found

---

## Security Score Breakdown

| Category | Score | Status | Change |
|----------|-------|--------|--------|
| Authentication/Authorization | 9/10 | ✅ Excellent | +1 (WebSocket fix) |
| Input Validation | 5/10 | ❌ Critical Issues | -2 (Mass assignment) |
| Secrets Management | 6/10 | ⚠️ Missing vars | -3 (Missing critical vars) |
| XSS Protection | 9/10 | ✅ Excellent | No change |
| SQL Injection Protection | 9/10 | ✅ Excellent | No change |
| CSRF Protection | 8/10 | ✅ Good | No change |
| API Security | 8/10 | ✅ Good | +1 (WebSocket fix) |
| Error Handling | 8/10 | ✅ Good | No change |
| File Security | 7/10 | ⚠️ Header injection | -1 (Header issue) |

**Overall Security Score: 6.5/10** (Down from 7.5/10)

With all critical and high issues fixed: **9.0/10**

---

## Immediate Action Items (BLOCKING PRODUCTION)

### CRITICAL - Must Fix Before Deployment

1. **Fix mass assignment vulnerabilities** (CRITICAL) ❌
   - Add field whitelisting to all update functions
   - Affected controllers: projects, patterns, yarn, recipients, tools
   - Estimated time: 2-3 hours
   - **BLOCKS PRODUCTION DEPLOYMENT**

2. **Add missing environment variables** (CRITICAL) ❌
   - Generate and add CSRF_SECRET
   - Generate and add JWT_REFRESH_SECRET
   - Ensure they're different from each other and JWT_SECRET
   - Estimated time: 15 minutes
   - **BLOCKS PRODUCTION DEPLOYMENT**

### HIGH - Should Fix Soon

3. **Validate JWT secrets are different** (HIGH) ❌
   - Add validation in jwt.ts
   - Estimated time: 5 minutes

4. **Fix Content-Disposition header injection** (HIGH) ❌
   - Escape filename in uploadsController.ts
   - Estimated time: 10 minutes

5. **Make cookie sameSite settings consistent** (HIGH) ❌
   - Use 'lax' consistently across all auth endpoints
   - Estimated time: 10 minutes

---

## Recommendations Summary

### Before Production Deployment (REQUIRED):
1. ❌ Fix mass assignment vulnerabilities
2. ❌ Add missing environment variables (CSRF_SECRET, JWT_REFRESH_SECRET)
3. ❌ Validate JWT secrets are different
4. ❌ Fix Content-Disposition header injection
5. ❌ Fix cookie sameSite inconsistency

### Short-term (next sprint):
6. Add explicit algorithm to JWT signing
7. Use crypto.randomBytes() for reset tokens
8. Add filename sanitization for file downloads
9. Update Jest dependencies

### Long-term:
10. Simplify authentication (choose JWT OR cookies, not both)
11. Implement API versioning
12. Add CSP reporting
13. Consider adding field-level encryption for sensitive data

---

## Testing Recommendations

### Security Testing Needed:
1. **Mass Assignment Testing:**
   - Attempt to modify user_id, deleted_at, created_at in update requests
   - Verify field whitelisting works after fix

2. **Environment Variable Testing:**
   - Test application startup with missing variables
   - Verify proper error messages

3. **WebSocket Testing:** ✅
   - Test joining rooms for non-owned projects
   - Verify error handling

4. **Header Injection Testing:**
   - Upload files with special characters in names
   - Test Content-Disposition header output

5. **Cookie Testing:**
   - Test auth flow with different sameSite settings
   - Verify cross-origin requests work correctly

---

## Comparison with Previous Audit

| Issue | Previous Status | Current Status | Progress |
|-------|----------------|----------------|----------|
| Mass Assignment | ❌ Critical | ❌ Critical | No change |
| Missing Env Vars | ❌ Critical | ❌ Critical | No change |
| WebSocket Auth | ❌ High | ✅ Fixed | ✅ FIXED |
| JWT Secret Validation | ❌ High | ❌ High | No change |
| Cookie Inconsistency | ⚠️ Medium | ❌ High | Upgraded severity |
| Header Injection | ⚠️ Medium | ❌ High | Upgraded severity |
| JWT Algorithm | ⚠️ Low | ⚠️ Low | No change |
| Reset Token | ⚠️ Low | ⚠️ Low | No change |

**Progress:** 1/8 issues resolved (12.5%)
**Fixes Needed:** 7 issues remain

---

## Conclusion

The codebase demonstrates strong security awareness with many best practices correctly implemented. **However, critical production-blocking issues remain unresolved.**

### ✅ Positive Changes:
- WebSocket authorization has been properly fixed with ownership verification
- All authentication and authorization checks are solid
- Input sanitization is comprehensive
- No new critical vulnerabilities introduced

### ❌ Critical Blockers:
1. **Mass assignment vulnerability** - This is a CRITICAL security flaw that could allow attackers to modify database fields they shouldn't have access to, including stealing projects by changing user_id. **MUST be fixed before production.**

2. **Missing environment variables** - Application will crash on startup without CSRF_SECRET and JWT_REFRESH_SECRET. **MUST be added before deployment.**

### Overall Assessment:
**Application is NOT ready for production deployment** until critical issues are resolved.

Estimated time to fix critical issues: **3-4 hours**

Once the immediate action items are addressed, this application will have a robust security posture suitable for production use with a security score of **9.0/10**.

---

**Audit Completed:** 2025-11-17
**Next Audit Recommended:** Immediately after implementing fixes
**Auditor:** Claude Code
**Status:** 🔴 PRODUCTION BLOCKED - Critical issues must be resolved
