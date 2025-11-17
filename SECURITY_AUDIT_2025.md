# Security Audit Report - November 2025
**Date:** 2025-11-17
**Auditor:** Claude Code
**Branch:** claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy
**Previous Audit:** CRITICAL_ISSUES_FOUND.md

---

## Executive Summary

This comprehensive security audit was conducted to verify fixes from the previous audit and identify new vulnerabilities. The audit examined authentication, authorization, input validation, CORS, CSRF protection, and common web vulnerabilities.

**Overall Security Score: 7.5/10**

**Previous Critical Issues Status:**
- ✅ **FIXED:** Backend cookie SameSite policy changed from 'strict' to 'lax'
- ✅ **FIXED:** Frontend axios configured with withCredentials: true
- ✅ **FIXED:** Axios base configuration created and imported in main.tsx

**New Critical Issues Found:** 2
**High Priority Issues:** 3
**Medium Priority Issues:** 5
**Low Priority Issues:** 4

---

## 🔴 CRITICAL VULNERABILITIES (Immediate Action Required)

### 1. Mass Assignment Vulnerability
**Severity:** CRITICAL
**Impact:** Attackers can modify arbitrary database fields including user_id, deleted_at, created_at

**Affected Files:**
- `backend/src/controllers/projectsController.ts:170`
- `backend/src/controllers/patternsController.ts:176`
- `backend/src/controllers/yarnController.ts:155`
- `backend/src/controllers/recipientsController.ts:139`
- `backend/src/controllers/toolsController.ts:137`

**Vulnerable Code:**
```typescript
export async function updateProject(req: Request, res: Response) {
  const updates = req.body;
  const [updatedProject] = await db('projects')
    .where({ id })
    .update({
      ...updates,  // ❌ VULNERABLE - accepts any field
      updated_at: new Date(),
    })
}
```

**Attack Scenario:**
```javascript
// Attacker sends:
PUT /api/projects/123
{
  "name": "My Project",
  "user_id": "attacker-user-id",  // Can steal the project!
  "deleted_at": null,
  "is_admin": true
}
```

**Required Fix:**
```typescript
// Whitelist allowed fields
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

---

### 2. Missing Required Environment Variables
**Severity:** CRITICAL
**Impact:** Application will fail to start in production

**Missing Variables in `backend/.env`:**
- `CSRF_SECRET` - Required by app.ts:78-81
- `JWT_REFRESH_SECRET` - Required by utils/jwt.ts:14

**Current Status:**
- Code has validation that throws error on startup if missing
- Production environment will crash on container start
- Development might be using fallback values

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
```

**Priority:** Add before next deployment

---

## 🟠 HIGH PRIORITY ISSUES (Should be fixed soon)

### 3. WebSocket Authorization Weakness
**Severity:** HIGH
**Impact:** Users can join WebSocket rooms for projects they don't own

**File:** `backend/src/config/socket.ts:49-51`

**Vulnerable Code:**
```typescript
socket.on('join:project', (projectId: string) => {
  socket.join(`project:${projectId}`);  // ❌ No ownership check!
  logger.info(`User ${userId} joined project room: ${projectId}`);
});
```

**Attack Scenario:**
User can join any project's room and receive real-time updates for projects they don't own.

**Required Fix:**
```typescript
socket.on('join:project', async (projectId: string) => {
  // Verify user owns this project
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .first();

  if (project) {
    socket.join(`project:${projectId}`);
    logger.info(`User ${userId} joined project room: ${projectId}`);
  } else {
    logger.warn(`User ${userId} denied access to project room: ${projectId}`);
  }
});
```

**Apply same fix to:**
- `join:pattern`
- `join:session`
- All other room join events

---

### 4. Potential SQL Injection in Search Queries
**Severity:** HIGH (but likely mitigated by Knex.js)
**Impact:** Could allow SQL injection if Knex.js parameterization fails

**Files:**
- `backend/src/controllers/projectsController.ts:24`
- `backend/src/controllers/patternsController.ts:32`
- `backend/src/controllers/yarnController.ts:25`

**Code:**
```typescript
if (search) {
  query = query.where((builder) => {
    builder
      .where('name', 'ilike', `%${search}%`)  // Template literal interpolation
      .orWhere('description', 'ilike', `%${search}%`);
  });
}
```

**Status:** Likely safe because Knex.js handles parameterization, but not ideal.

**Recommended Fix:**
```typescript
import validator from 'validator';

if (search) {
  const sanitizedSearch = validator.escape(search.toString());
  query = query.where((builder) => {
    builder
      .where('name', 'ilike', `%${sanitizedSearch}%`)
      .orWhere('description', 'ilike', `%${sanitizedSearch}%`);
  });
}
```

---

### 5. JWT Secret Validation Missing
**Severity:** HIGH
**Impact:** If JWT_SECRET === JWT_REFRESH_SECRET, token separation is compromised

**File:** `backend/src/utils/jwt.ts:13-14`

**Current Code:**
```typescript
const JWT_SECRET = getRequiredEnv('JWT_SECRET');
const JWT_REFRESH_SECRET = getRequiredEnv('JWT_REFRESH_SECRET');
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

---

## 🟡 MEDIUM PRIORITY ISSUES (Good to fix)

### 6. CSRF Protection Complexity
**Severity:** MEDIUM
**File:** `backend/src/middleware/csrf.ts:85`

**Issue:** App uses both JWT (in headers) AND cookies for authentication, creating complexity.

**Code:**
```typescript
const hasJWT = req.headers.authorization?.startsWith('Bearer ');
if (skipPaths.some(path => req.path.startsWith(path)) || hasJWT) {
  return next();  // CSRF skipped
}
```

**Status:** Acceptable for API usage, but creates confusion about which auth method to use.

**Recommendation:** Choose one authentication method and stick to it:
- **Option A:** Cookie-based only (remove JWT from headers)
- **Option B:** JWT-based only (remove cookie setting)

**Current state:** Both are used, which is not wrong but increases attack surface.

---

### 7. Cookie SameSite Inconsistency
**Severity:** MEDIUM
**Files:**
- `backend/src/controllers/authController.ts:163` (login uses 'lax')
- `backend/src/controllers/authController.ts:249` (refresh uses 'strict')

**Issue:** Inconsistent sameSite settings across authentication flows.

**Code:**
```typescript
// Login - uses 'lax'
sameSite: 'lax' as const,

// Token refresh - might use different settings
```

**Recommendation:** Use consistent settings throughout. For production with HTTPS:
```typescript
const cookieOptions = {
  httpOnly: true,
  secure: true,  // Always true in production
  sameSite: 'lax' as const,  // Use 'lax' for all auth cookies
};
```

---

### 8. Content-Disposition Header Injection
**Severity:** MEDIUM
**File:** `backend/src/controllers/uploadsController.ts:523, 525`

**Vulnerable Code:**
```typescript
res.setHeader('Content-Disposition', `inline; filename="${file.original_filename}"`);
```

**Attack Scenario:**
User uploads file named: `test";malicious="value.pdf`

**Required Fix:**
```typescript
const escapedFilename = file.original_filename.replace(/"/g, '\\"');
res.setHeader('Content-Disposition', `inline; filename="${escapedFilename}"`);
```

---

### 9. File Path Injection Potential
**Severity:** MEDIUM
**File:** `backend/src/controllers/uploadsController.ts:505`

**Code:**
```typescript
const filepath = path.join('uploads/patterns', file.filename);
```

**Status:** Likely safe - filename is generated by the app, not user-controlled.

**Recommended Fix (defense in depth):**
```typescript
const sanitizedFilename = path.basename(file.filename);
const filepath = path.join('uploads/patterns', sanitizedFilename);
```

---

### 10. Error Stack Traces in Production
**Severity:** MEDIUM
**File:** `backend/src/utils/errorHandler.ts:96`

**Code:**
```typescript
res.status(statusCode).json({
  success: false,
  message,
  ...(errors && { errors }),
  ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
});
```

**Status:** Good implementation, but relies on environment variable.

**Recommended Improvement:**
```typescript
...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
```

---

## 🟢 LOW PRIORITY ISSUES (Nice to have)

### 11. Rate Limiting Key Fallback
**Severity:** LOW
**File:** `backend/src/middleware/rateLimiter.ts:22, 47, 68`

**Code:**
```typescript
return (req as any).user?.userId || req.ip || 'unknown';
```

**Issue:** Falls back to 'unknown' if IP is not available, allowing unlimited requests.

**Recommendation:**
```typescript
const key = (req as any).user?.userId || req.ip;
if (!key) {
  throw new Error('Cannot identify request source for rate limiting');
}
return key;
```

---

### 12. Bcrypt Rounds Configurable
**Severity:** LOW
**File:** `backend/src/utils/password.ts:3`

**Code:**
```typescript
const SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');
```

**Issue:** Could be set to weak value like '4'.

**Recommendation:**
```typescript
const SALT_ROUNDS = Math.max(12, parseInt(process.env.BCRYPT_ROUNDS || '12'));
```

---

### 13. JWT Algorithm Not Specified
**Severity:** LOW
**File:** `backend/src/utils/jwt.ts:34-38`

**Code:**
```typescript
return jwt.sign(
  { ...payload, jti: uuidv4() },
  JWT_SECRET,
  { expiresIn: JWT_EXPIRY }
);
```

**Issue:** Vulnerable to algorithm confusion attacks.

**Recommendation:**
```typescript
return jwt.sign(
  { ...payload, jti: uuidv4() },
  JWT_SECRET,
  { expiresIn: JWT_EXPIRY, algorithm: 'HS256' }
);
```

---

### 14. Password Reset Token Weak Randomness
**Severity:** LOW
**File:** `backend/src/utils/jwt.ts:91-92`

**Code:**
```typescript
export function generateResetToken(): string {
  return uuidv4() + uuidv4(); // UUID is not cryptographically strong
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

3. **Authentication** ✅
   - JWT tokens properly implemented
   - Token expiration enforced
   - Sessions properly managed with revocation support
   - User verification checks active status and soft deletes

4. **Authorization** ✅
   - All routes protected with authentication middleware
   - User ownership verified before operations
   - UUID validation on all ID parameters

5. **Rate Limiting** ✅
   - Implemented with Redis backing
   - Different limits for different endpoints
   - IP-based and user-based rate limiting

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
   - File size limits enforced
   - Files processed with Sharp (safe image processing)
   - Ownership verification before file operations

9. **XSS Protection** ✅
   - No dangerouslySetInnerHTML found
   - React's built-in escaping utilized
   - Input sanitization applied globally

10. **Secrets Management** ✅
    - .env files properly gitignored
    - No hardcoded secrets in code
    - Environment variables validated at startup

11. **SQL Injection Protection** ✅
    - Using Knex.js query builder (parameterized)
    - All db.raw() calls use parameterized placeholders
    - No string concatenation in queries

12. **Audit Logging** ✅
    - All significant actions logged
    - IP address and user tracked
    - Old/new values recorded for updates

---

## Previous Audit Status

### Issue #1: Backend Cookie SameSite Policy ✅ FIXED
**Previous:** `sameSite: 'strict'` blocked cross-origin cookies
**Current:** `sameSite: 'lax'` allows proper cookie transmission
**File:** `backend/src/controllers/authController.ts:163`

### Issue #2: Frontend Missing withCredentials ✅ FIXED
**Previous:** Axios not configured to send cookies
**Current:** `axios.defaults.withCredentials = true` configured
**File:** `frontend/src/lib/axios.ts:4`

### Issue #3: Frontend No Axios Base Configuration ✅ FIXED
**Previous:** No axios instance with defaults
**Current:** Created `frontend/src/lib/axios.ts` with proper configuration
**Import:** Added to `frontend/src/main.tsx:9`

---

## Environment Variable Audit

### Properly Secured ✅
- .env files in .gitignore
- Only .example files tracked in git
- No .env files in git history
- Secrets not hardcoded in code

### Missing Required Variables ❌
**Backend .env is missing:**
- `CSRF_SECRET` (required by app.ts)
- `JWT_REFRESH_SECRET` (required by utils/jwt.ts)

**These must be added before production deployment!**

---

## Dependency Vulnerabilities

**Status:** Some moderate vulnerabilities in Jest (devDependency)
- Not critical for production (testing library only)
- Vulnerabilities are in test infrastructure, not runtime
- Recommendation: Update Jest to latest version

---

## Security Score Breakdown

| Category | Score | Status |
|----------|-------|--------|
| Authentication/Authorization | 9/10 | ✅ Excellent |
| Input Validation | 7/10 | ⚠️ Mass assignment issue |
| Secrets Management | 9/10 | ⚠️ Missing env vars |
| XSS Protection | 9/10 | ✅ Excellent |
| SQL Injection Protection | 9/10 | ✅ Excellent |
| CSRF Protection | 8/10 | ✅ Good |
| API Security | 7/10 | ⚠️ WebSocket auth |
| Error Handling | 8/10 | ✅ Good |

**Overall Security Score: 7.5/10**

With critical issues fixed: **8.5-9/10**

---

## Immediate Action Items

1. **Fix mass assignment vulnerabilities** (CRITICAL)
   - Add field whitelisting to all update functions
   - Estimated time: 2-3 hours

2. **Add missing environment variables** (CRITICAL)
   - Generate and add CSRF_SECRET
   - Generate and add JWT_REFRESH_SECRET
   - Ensure they're different from each other
   - Estimated time: 15 minutes

3. **Fix WebSocket authorization** (HIGH)
   - Add ownership checks to all room join events
   - Estimated time: 1 hour

4. **Validate JWT secrets are different** (HIGH)
   - Add validation in jwt.ts
   - Estimated time: 5 minutes

---

## Recommendations Summary

**Before Production Deployment:**
1. Fix mass assignment vulnerabilities
2. Add missing environment variables
3. Fix WebSocket authorization
4. Add JWT secret validation

**Short-term (next sprint):**
5. Add explicit algorithm to JWT signing
6. Fix Content-Disposition header injection
7. Make cookie sameSite settings consistent
8. Add filename sanitization for file downloads

**Long-term:**
9. Simplify authentication (choose JWT OR cookies, not both)
10. Update test dependencies
11. Implement API versioning
12. Add CSP reporting

---

## Conclusion

The codebase demonstrates strong security awareness with many best practices correctly implemented. The previous critical authentication issues have been successfully resolved.

The primary concern is the **mass assignment vulnerability** which could allow attackers to modify database fields they shouldn't have access to. This must be fixed before production deployment.

Once the immediate action items are addressed, this application will have a robust security posture suitable for production use.

**Audit Completed:** 2025-11-17
**Next Audit Recommended:** After implementing fixes, or in 3 months
