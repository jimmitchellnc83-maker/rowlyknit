import { readFileSync } from 'fs';
import { join } from 'path';

describe('deployment/nginx/conf.d/rowlyknit.conf', () => {
  const conf = readFileSync(
    join(__dirname, '..', '..', '..', 'deployment', 'nginx', 'conf.d', 'rowlyknit.conf'),
    'utf8'
  );

  // Regression: PR after platform audit 2026-04-30 critical #1.
  // Without this proxy block, every "Make project public" share page renders
  // the SPA shell, then the client-side fetch for /shared/project/:slug returns
  // index.html, axios fails to parse, and the page shows an error state.
  it('proxies /shared/ on rowlyknit.com to the backend', () => {
    const sharedBlock = conf.match(
      /location\s+\/shared\/\s*\{[^}]*proxy_pass\s+http:\/\/backend:5000[^}]*\}/s
    );
    expect(sharedBlock).not.toBeNull();
  });

  it('still proxies /api/ to the backend', () => {
    expect(conf).toMatch(
      /location\s+\/api\/\s*\{[^}]*proxy_pass\s+http:\/\/backend:5000/s
    );
  });

  // Regression: audit op-gap finding — auth limiter was returning 503 on
  // rate-limit, which axios surfaces as "Service unavailable. Server might
  // be down." (looks like an outage). 429 is the honest semantic.
  it('configures /api/auth/ to return 429 when rate-limited (not 503)', () => {
    const authBlocks = conf.match(
      /location\s+\/api\/auth\/\s*\{[^}]*\}/gs
    );
    expect(authBlocks).not.toBeNull();
    expect(authBlocks!.length).toBeGreaterThanOrEqual(1);
    authBlocks!.forEach((block) => {
      expect(block).toMatch(/limit_req_status\s+429\s*;/);
    });
  });

  // Regression: PR after platform audit 2026-04-30 critical #5.
  // Without plausible.io in script-src + connect-src the analytics script
  // is blocked by CSP, the queue stub is never replaced, and every
  // trackEvent call silently drops on prod.
  describe('Content-Security-Policy on rowlyknit.com', () => {
    const cspMatch = conf.match(
      /add_header Content-Security-Policy "([^"]+)"\s+always;/
    );
    const csp = cspMatch?.[1] ?? '';

    it('extracts a CSP header from the rowlyknit.com server block', () => {
      expect(csp).not.toBe('');
    });

    it('allows https://plausible.io in script-src', () => {
      const scriptSrc = csp.match(/script-src\s+([^;]+)/)?.[1] ?? '';
      expect(scriptSrc).toMatch(/https:\/\/plausible\.io/);
    });

    it('allows https://plausible.io in connect-src', () => {
      const connectSrc = csp.match(/connect-src\s+([^;]+)/)?.[1] ?? '';
      expect(connectSrc).toMatch(/https:\/\/plausible\.io/);
    });
  });

  // Regression: Platform Hardening Sprint 2026-05-05.
  //
  // Backend already retired the unauthenticated `app.use('/uploads',
  // express.static(...))` mount (migration 070). The nginx vhost still
  // had two `alias /usr/share/nginx/html/uploads` blocks (one per server
  // context) that mapped any guessed `/uploads/<hex>.<ext>` URL straight
  // to the production volume — bypassing every ownership check in
  // uploadsController, sourceFilesController, notesController, etc.
  //
  // These assertions lock the post-fix contract: every uploaded asset
  // (project / yarn photos, pattern PDFs, source files, audio notes,
  // chart images, handwritten notes) must traverse the auth-streaming
  // /api/uploads/* surface; raw /uploads/... must 404 at the edge so a
  // misconfigured backend container or future regression cannot quietly
  // re-expose private bytes.
  describe('uploads exposure (Platform Hardening Sprint 2026-05-05)', () => {
    it('contains zero `alias .../uploads` directives anywhere in the file', () => {
      // The historical exposure shape was `alias /usr/share/nginx/html/uploads;`.
      // Any future edit that points an alias at a different on-disk
      // upload tree is equally unsafe — the auth-streaming endpoints
      // are the only sanctioned read path.
      const matches = conf.match(/alias\s+[^;]*uploads[^;]*;/g) ?? [];
      expect(matches).toEqual([]);
    });

    it('contains zero `root .../uploads` directives anywhere in the file', () => {
      // `root` would be a different way to spell the same exposure
      // (`location /uploads { root /usr/share/nginx/html; }`).
      const matches = conf.match(/^\s*root\s+[^;]*uploads[^;]*;/gm) ?? [];
      expect(matches).toEqual([]);
    });

    it('every `location /uploads*` block returns 404 (no proxy_pass / alias / root)', () => {
      // Find every location block whose path begins with /uploads, with
      // or without `^~` prefix-priority modifier, with or without a
      // trailing slash. Per-block: must `return 404;` and must not
      // smuggle the bytes through a different directive.
      const locationRegex =
        /location\s+(?:\^~\s+)?\/uploads\/?\s*\{([^{}]*)\}/g;
      const blocks: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = locationRegex.exec(conf)) !== null) {
        blocks.push(m[1]);
      }
      // We expect at least 4 blocks (api server + frontend server,
      // each with a `/uploads` and a `/uploads/` form). A future edit
      // that collapses or re-shapes them is fine as long as every
      // remaining block still 404s.
      expect(blocks.length).toBeGreaterThanOrEqual(4);
      blocks.forEach((body) => {
        expect(body).toMatch(/return\s+404\s*;/);
        expect(body).not.toMatch(/proxy_pass/);
        expect(body).not.toMatch(/alias/);
        expect(body).not.toMatch(/\broot\s+/);
      });
    });

    it('keeps the authenticated /api/ proxy path wired (regression guard)', () => {
      // Defense against an over-zealous edit that strips the upload
      // surface entirely. /api/uploads/* IS authenticated and must
      // remain reachable; nothing in this PR touches it.
      expect(conf).toMatch(/location\s+\/api\/\s*\{/);
    });
  });
});
