/**
 * QA sprint 2026-05-04: the project sidebar's pattern + tool action
 * buttons used to render at ~24-30px tall (text-xs, tight padding) and
 * blew through the 44px minimum touch target the rest of the app already
 * enforces (memory: feedback_44px_touch_minimum). This file pins the
 * minimum-sizing classes so a future tweak that drops them re-fails
 * deterministically rather than silently making the buttons cramped on
 * iPad / PWA again.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProjectPatternsList from './ProjectPatternsList';
import ProjectToolsList from './ProjectToolsList';

describe('Project sidebar — 44px touch targets', () => {
  it('Patterns header buttons + remove button meet the 44px minimum', () => {
    render(
      <MemoryRouter>
        <ProjectPatternsList
          patterns={[{ id: 'p1', name: 'Cabled Sweater' }]}
          onRemove={vi.fn()}
          onSelectClick={vi.fn()}
          onUploadClick={vi.fn()}
        />
      </MemoryRouter>,
    );
    const select = screen.getByRole('button', { name: /select/i });
    const upload = screen.getByRole('button', { name: /upload/i });
    const remove = screen.getByRole('button', { name: /remove cabled sweater/i });
    for (const btn of [select, upload]) {
      expect(btn.className).toMatch(/min-h-\[44px\]/);
    }
    // Remove uses a square 44×44 sizing variant
    expect(remove.className).toMatch(/h-11/);
    expect(remove.className).toMatch(/w-11/);
  });

  it('Tools add + remove buttons meet the 44px minimum', () => {
    render(
      <ProjectToolsList
        tools={[{ id: 't1', name: 'US 8 needles' }]}
        onRemove={vi.fn()}
        onAddClick={vi.fn()}
      />,
    );
    const add = screen.getByRole('button', { name: /add tool/i });
    const remove = screen.getByRole('button', { name: /remove us 8 needles/i });
    for (const btn of [add, remove]) {
      expect(btn.className).toMatch(/h-11/);
      expect(btn.className).toMatch(/w-11/);
    }
  });
});
