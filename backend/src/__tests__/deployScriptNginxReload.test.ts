import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Regression test for PR #382 deploy gap (Codex Sprint 383).
 *
 * `deployment/nginx/conf.d/*.conf` is bind-mounted into the running
 * `rowly_nginx` container, which means route-config changes don't take
 * effect on a deploy unless we explicitly reload nginx. PR #382 added
 * `/calculators/size`, the auto-deploy reported success, but the route
 * 404'd until the operator manually `docker compose exec nginx nginx
 * -s reload`d the box.
 *
 * `scripts/deploy-production.sh` now runs `nginx -t` and `nginx -s
 * reload` inside the container at the end of the deploy. We pin the
 * shape here so a future refactor that drops one of those lines fails
 * CI rather than silently re-introducing the gap.
 *
 * The deploy is shell-only and there's no integration test harness
 * for it; this static check is the lightweight contract guard.
 */
describe('scripts/deploy-production.sh — nginx config validate + reload', () => {
  const script = readFileSync(
    join(__dirname, '..', '..', '..', 'scripts', 'deploy-production.sh'),
    'utf8'
  );

  it('runs `nginx -t` inside the nginx container before reloading', () => {
    expect(script).toMatch(/docker compose exec[^\n]*\bnginx\b[^\n]*\bnginx -t\b/);
  });

  it('aborts the deploy if `nginx -t` fails (non-zero exit, no reload)', () => {
    // We expect a guard like `if ! docker compose exec ... nginx -t; then ... exit 1; fi`
    expect(script).toMatch(
      /if\s+!\s+docker compose exec[^\n]*nginx -t[\s\S]*?exit\s+1[\s\S]*?fi/
    );
  });

  it('runs `nginx -s reload` inside the nginx container after the validate step', () => {
    const reloadIdx = script.search(/docker compose exec[^\n]*\bnginx\b[^\n]*\bnginx -s reload\b/);
    const validateIdx = script.search(/docker compose exec[^\n]*\bnginx\b[^\n]*\bnginx -t\b/);
    expect(reloadIdx).toBeGreaterThan(-1);
    expect(validateIdx).toBeGreaterThan(-1);
    expect(reloadIdx).toBeGreaterThan(validateIdx);
  });
});

describe('.github/workflows/deploy-production.yml — references nginx reload step', () => {
  const wf = readFileSync(
    join(__dirname, '..', '..', '..', '.github', 'workflows', 'deploy-production.yml'),
    'utf8'
  );

  it('mentions nginx -t and nginx -s reload in its deploy step description', () => {
    // The reload itself happens inside scripts/deploy-production.sh, but
    // the workflow comment block needs to surface it so reviewers can
    // see at a glance that bind-mounted route changes will pick up.
    expect(wf).toMatch(/nginx -t/);
    expect(wf).toMatch(/nginx -s reload/);
  });
});
