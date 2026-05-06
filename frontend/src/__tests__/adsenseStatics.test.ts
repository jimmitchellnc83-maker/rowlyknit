/**
 * Static-asset pins for AdSense.
 *
 * The deploy pipeline serves `frontend/index.html` and
 * `frontend/public/ads.txt` through nginx. Both must contain the right
 * AdSense markers; both are verified here so a typo in one PR doesn't
 * silently break ad delivery.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const FRONTEND_ROOT = path.resolve(__dirname, '../..');

describe('AdSense static assets', () => {
  it('index.html loads the AdSense script with the right publisher id', () => {
    const html = fs.readFileSync(path.join(FRONTEND_ROOT, 'index.html'), 'utf8');
    expect(html).toContain('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js');
    expect(html).toContain('client=ca-pub-9472587145183950');
    expect(html).toContain('crossorigin="anonymous"');
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
