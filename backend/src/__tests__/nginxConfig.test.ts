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
});
