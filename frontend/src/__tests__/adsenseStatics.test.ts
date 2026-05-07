/**
 * Static-asset pins for AdSense.
 *
 * The deploy pipeline serves `frontend/index.html`,
 * `frontend/public/ads.txt`, and the bundled JS through nginx. The
 * AdSense script is no longer in `index.html` (it's injected by
 * `useAdSenseScript` only on approved routes). We verify:
 *   - `index.html` does NOT carry the AdSense `<script>` tag.
 *   - `useAdSenseScript.ts` carries the canonical publisher id +
 *     `adsbygoogle.js` URL — that's the one and only place the FE
 *     loads the third-party script.
 *   - `public/ads.txt` still contains the publisher attribution line
 *     (independent of the script load location).
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const FRONTEND_ROOT = path.resolve(__dirname, '../..');

describe('AdSense static assets', () => {
  it('index.html does NOT include the AdSense script tag (route-scoped via useAdSenseScript)', () => {
    const html = fs.readFileSync(path.join(FRONTEND_ROOT, 'index.html'), 'utf8');
    expect(html).not.toContain('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js');
  });

  it('useAdSenseScript.ts loads the AdSense script with the right publisher id', () => {
    const hookSrc = fs.readFileSync(
      path.join(FRONTEND_ROOT, 'src', 'components', 'ads', 'useAdSenseScript.ts'),
      'utf8',
    );
    expect(hookSrc).toContain('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js');
    expect(hookSrc).toContain('client=');
    // Real id comes from adRoutes.ts:
    const adRoutesSrc = fs.readFileSync(
      path.join(FRONTEND_ROOT, 'src', 'components', 'ads', 'adRoutes.ts'),
      'utf8',
    );
    expect(adRoutesSrc).toContain('ca-pub-9472587145183950');
  });

  it('public/ads.txt contains the canonical google.com line', () => {
    const txt = fs.readFileSync(path.join(FRONTEND_ROOT, 'public', 'ads.txt'), 'utf8');
    const lines = txt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    expect(lines).toContain('google.com, pub-9472587145183950, DIRECT, f08c47fec0942fa0');
  });

  it('public/ads.txt has only allowed lines (no extra publishers leaked in)', () => {
    const txt = fs.readFileSync(path.join(FRONTEND_ROOT, 'public', 'ads.txt'), 'utf8');
    const lines = txt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    // Today there is exactly one line. If we add more publishers later,
    // bump this test along with the file.
    expect(lines.length).toBe(1);
  });
});
