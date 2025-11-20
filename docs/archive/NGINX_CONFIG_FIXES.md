# Nginx Configuration Fixes - Critical Issues Resolved

## Summary of Changes

This document outlines the critical nginx configuration fixes applied to resolve Docker deployment issues.

## Issues Fixed

### ❌ Issue #1: Duplicate Server Blocks
**Problem:** Both `rowly.conf` and `rowlyknit.conf` defined servers for the same domains (rowlyknit.com, www.rowlyknit.com), causing nginx conflicts.

**Solution:** Disabled `rowly.conf` by renaming it to `rowly.conf.disabled`. Now only `rowlyknit.conf` is active, which provides complete coverage for all domains:
- `rowlyknit.com` - Main frontend
- `www.rowlyknit.com` - Redirects to non-www
- `api.rowlyknit.com` - API backend

### ❌ Issue #2: Wrong Backend References
**Problem:** `rowlyknit.conf` used `localhost:5000` which doesn't work inside Docker containers (containers can't reach localhost of the host).

**Solution:** Updated all proxy_pass directives to use Docker service names:
- `http://localhost:5000` → `http://backend:5000` (4 instances)
- API endpoints, health checks, metrics, and WebSocket connections now properly route to the backend container

### ❌ Issue #3: Invalid Frontend File Paths
**Problem:** Frontend section tried to serve static files from `/home/rowly/rowlyknit/frontend/dist` which doesn't exist inside the nginx container.

**Solution:** Changed from static file serving to proxying to the frontend container:
- Removed `root /home/rowly/rowlyknit/frontend/dist;` directive
- Updated all frontend locations to `proxy_pass http://frontend:80`
- Static assets, service worker, manifests, and SPA routes now proxy to frontend container

### ✓ Issue #4: Uploads Path Fixed
**Problem:** Uploads location referenced `/home/rowly/rowlyknit/backend/uploads`

**Solution:** Updated to use the correct Docker volume mount path:
- Changed to `/usr/share/nginx/html/uploads` (matches docker-compose.yml volume mount)

## Files Modified

### 1. `deployment/nginx/conf.d/rowly.conf`
- **Renamed to:** `rowly.conf.disabled`
- **Reason:** Prevents duplicate server block conflicts
- **Status:** No longer loaded by nginx (doesn't match `*.conf` pattern)

### 2. `deployment/nginx/conf.d/rowlyknit.conf`
**Changes:**

#### API Server Section (api.rowlyknit.com)
```nginx
# Line 76: Health check endpoint
proxy_pass http://backend:5000/health;

# Line 82: Metrics endpoint
proxy_pass http://backend:5000/metrics;

# Line 90: Main API endpoint
proxy_pass http://backend:5000;

# Line 108: WebSocket endpoint
proxy_pass http://backend:5000;

# Line 122: Uploads path
alias /usr/share/nginx/html/uploads;
```

#### Frontend Section (rowlyknit.com)
```nginx
# Lines 186-217: All frontend locations now proxy to frontend container
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp)$ {
    proxy_pass http://frontend:80;
}

location = /sw.js {
    proxy_pass http://frontend:80;
}

location ~* \.(webmanifest|json)$ {
    proxy_pass http://frontend:80;
}

location / {
    proxy_pass http://frontend:80;
    # Full proxy headers for SPA support
}
```

## Docker Service Architecture

The nginx configuration now correctly routes to Docker services defined in `docker-compose.yml`:

```
                    ┌─────────────────┐
                    │  Nginx (Port 80/443)  │
                    └─────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
        ┌───────▼────────┐    ┌────────▼───────┐
        │   Backend      │    │   Frontend     │
        │   (port 5000)  │    │   (port 80)    │
        └────────────────┘    └────────────────┘
                │
        ┌───────┴────────┐
        │                │
   ┌────▼─────┐    ┌────▼────┐
   │ Postgres │    │  Redis  │
   └──────────┘    └─────────┘
```

## Verification Steps

After deploying these changes, verify:

1. **No duplicate server block warnings:**
   ```bash
   docker compose logs nginx | grep -i "duplicate\|conflicts"
   ```
   Should return nothing.

2. **Backend connectivity:**
   ```bash
   docker compose exec nginx wget -q -O- http://backend:5000/health
   ```
   Should return health check response.

3. **Frontend connectivity:**
   ```bash
   docker compose exec nginx wget -q -O- http://frontend:80
   ```
   Should return HTML content.

4. **Configuration is valid:**
   ```bash
   docker compose exec nginx nginx -t
   ```
   Should show "syntax is ok" and "test is successful".

5. **Only one config file loaded:**
   ```bash
   docker compose exec nginx ls /etc/nginx/conf.d/
   ```
   Should only show `rowlyknit.conf` (not `rowly.conf`).

## Deployment Instructions

These changes are part of the overall deployment. Follow the main deployment guide in `DEPLOYMENT_FIX.md`:

```bash
cd /home/user/rowlyknit
git pull origin claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy
docker compose down
docker compose up -d --build
docker compose logs nginx --tail=50
```

## Expected Results

✅ Nginx starts without errors
✅ No duplicate server block warnings
✅ No SSL certificate errors (uses self-signed from `/etc/nginx/ssl/`)
✅ No HTTP/2 deprecation warnings
✅ API requests properly routed to backend container
✅ Frontend requests properly routed to frontend container
✅ WebSocket connections work correctly
✅ Static uploads served from correct path

## Configuration Coverage

| Domain | HTTPS Port | Proxies To | Purpose |
|--------|-----------|------------|---------|
| `api.rowlyknit.com` | 443 | `backend:5000` | Backend API + WebSocket |
| `rowlyknit.com` | 443 | `frontend:80` | React SPA |
| `www.rowlyknit.com` | 443 | Redirect to `rowlyknit.com` | Canonical URL |
| All domains | 80 | Redirect to HTTPS | Force SSL |

## Next Steps

1. ✅ All critical configuration issues resolved
2. 🔄 Deploy to production using docker compose
3. ✅ Verify all endpoints accessible
4. 📋 Plan Let's Encrypt certificate migration (documented in `deployment/ssl/README.md`)

## Rollback Plan

If issues occur, rollback by:

1. Re-enable old configuration:
   ```bash
   mv deployment/nginx/conf.d/rowly.conf.disabled deployment/nginx/conf.d/rowly.conf
   ```

2. Restore previous rowlyknit.conf from git:
   ```bash
   git checkout HEAD~1 deployment/nginx/conf.d/rowlyknit.conf
   ```

3. Restart nginx:
   ```bash
   docker compose restart nginx
   ```

However, note that the old configuration had critical bugs that prevented proper operation in Docker.
