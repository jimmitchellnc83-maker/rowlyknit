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
});
