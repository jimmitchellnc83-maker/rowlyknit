/**
 * Lock test for the Pattern Designer header layout (Codex finding,
 * Final Polish Sprint 1).
 *
 * The previous header packed title + Beta + Editing pill + Knit/Crochet
 * segmented control + 6 action buttons into a single `flex items-center`
 * row with `ml-auto` shoving the actions right. Below ~1100px the
 * actions clipped the Knit/Crochet toggle, which is a primary control.
 *
 * The fix splits the header into three logical groups (title block /
 * craft toggle / actions). On mobile + tablet the toggle gets its own
 * row with 44px touch targets; on lg+ everything inlines again.
 *
 * This test is intentionally a source-string assertion rather than a
 * render test — PatternDesigner.tsx is ~3.2k lines with heavy hook +
 * router + react-query dependencies, and the contract we care about
 * is the structural Tailwind classes, not visual output. A render
 * test here would be brittle without proving more.
 */

import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const SOURCE_PATH = path.join(__dirname, 'PatternDesigner.tsx');

describe('PatternDesigner — responsive header', () => {
  const src = fs.readFileSync(SOURCE_PATH, 'utf8');

  it('header is a vertical stack on small screens, inline-row on lg+', () => {
    // The outer header switches axis at the lg breakpoint. Without
    // `lg:flex-row` we'd be back to the old single-row collision.
    const re =
      /data-testid="designer-header"[^>]*className="[^"]*\bflex flex-col\b[^"]*\blg:flex-row\b[^"]*"/;
    expect(src).toMatch(re);
  });

  it('header allows wrapping (no overflow at intermediate widths)', () => {
    // `lg:flex-wrap` lets the actions break to a second row at narrow
    // desktop widths instead of crushing the toggle to its left.
    expect(src).toMatch(/data-testid="designer-header"[^>]*className="[^"]*\blg:flex-wrap\b[^"]*"/);
  });

  it('craft toggle has its own group and 44px touch targets on mobile/tablet', () => {
    // The segmented control is its own flex container, scoped to a
    // testid so we can both find it in DOM and assert its classes.
    expect(src).toMatch(/data-testid="designer-craft-toggle"/);

    // The buttons inside the segmented control must hit 44px min-height
    // up to lg, then drop back to compact desktop sizing.
    const knitBlock = src.match(
      /data-testid="designer-craft-toggle"[\s\S]*?<\/div>/m
    );
    expect(knitBlock).not.toBeNull();
    expect(knitBlock![0]).toMatch(/min-h-\[44px\]/);
    // And the desktop override must be present so we don't ship a
    // chunky toggle on >=lg widths.
    expect(knitBlock![0]).toMatch(/lg:min-h-0/);
  });

  it('action buttons live in their own group with `lg:ml-auto`, not inline `ml-auto`', () => {
    // The previous header used a hard `ml-auto` on the action group,
    // which forced layout collisions below desktop widths. The fix
    // keeps the right-alignment ONLY at lg+, where there's room.
    expect(src).toMatch(
      /data-testid="designer-header-actions"[^>]*className="[^"]*\blg:ml-auto\b[^"]*"/
    );
    // Sanity: the actions group must also wrap so a long set of
    // buttons doesn't push the toggle off-screen.
    expect(src).toMatch(
      /data-testid="designer-header-actions"[^>]*className="[^"]*\bflex-wrap\b[^"]*"/
    );
  });

  it('title block remains its own group (so Beta + Editing pill never get clipped)', () => {
    expect(src).toMatch(
      /data-testid="designer-header-title"[^>]*className="[^"]*\bflex flex-wrap\b[^"]*"/
    );
  });
});
