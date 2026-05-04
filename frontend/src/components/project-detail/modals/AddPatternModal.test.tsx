/**
 * Sprint 2 fix-up (Codex review on PR #375): the AddPatternModal must
 * route legacy and canonical-only picks to the correct backend branch.
 *
 * - Legacy pattern selected → submit `{ patternId }` (unchanged).
 * - Canonical-only pattern selected → submit `{ patternModelId }`.
 * - A canonical that already has a legacy twin must not appear twice in
 *   the picker (covered by `availablePatterns.test.ts`; this file pins
 *   the modal-level rendering of de-duped options + the submit shape).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AddPatternModal from './AddPatternModal';
import type { PatternPickerOption } from '../availablePatterns';

const legacyOnly: PatternPickerOption[] = [
  { id: 'legacy-1', kind: 'legacy', name: 'Cabled Sweater', designer: 'Alice' },
];

const mixedOptions: PatternPickerOption[] = [
  { id: 'legacy-1', kind: 'legacy', name: 'Cabled Sweater', designer: 'Alice' },
  { id: 'cpm-1', kind: 'canonical', name: 'Yoke chart (Designer-only)', designer: null },
];

describe('AddPatternModal — submit shapes', () => {
  it('posts {patternId} for legacy-kind selections', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <AddPatternModal
        options={legacyOnly}
        existingLegacyIds={[]}
        existingCanonicalIds={[]}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByTestId('add-pattern-select'), {
      target: { value: 'legacy:legacy-1' },
    });
    fireEvent.click(screen.getByTestId('add-pattern-submit'));

    expect(onSubmit).toHaveBeenCalledWith({ kind: 'legacy', id: 'legacy-1' });
  });

  it('posts {patternModelId} for canonical-kind selections', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <AddPatternModal
        options={mixedOptions}
        existingLegacyIds={[]}
        existingCanonicalIds={[]}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByTestId('add-pattern-select'), {
      target: { value: 'canonical:cpm-1' },
    });
    fireEvent.click(screen.getByTestId('add-pattern-submit'));

    expect(onSubmit).toHaveBeenCalledWith({ kind: 'canonical', id: 'cpm-1' });
  });

  it('flags canonical-only options visually so the user knows the source', () => {
    render(
      <AddPatternModal
        options={mixedOptions}
        existingLegacyIds={[]}
        existingCanonicalIds={[]}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    // Canonical option carries the "(Designer)" tag.
    const canonicalOption = screen
      .getAllByRole('option')
      .find((o) => o.textContent?.includes('(Designer)'));
    expect(canonicalOption).toBeDefined();
    expect(canonicalOption?.textContent).toMatch(/Yoke chart/);
  });
});

describe('AddPatternModal — already-attached filtering', () => {
  it('hides legacy options whose ids are in existingLegacyIds', () => {
    render(
      <AddPatternModal
        options={mixedOptions}
        existingLegacyIds={['legacy-1']}
        existingCanonicalIds={[]}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options.some((t) => t?.includes('Cabled Sweater'))).toBe(false);
    expect(options.some((t) => t?.includes('Yoke chart'))).toBe(true);
  });

  it('hides canonical options whose ids are in existingCanonicalIds (e.g., already attached via stub)', () => {
    render(
      <AddPatternModal
        options={mixedOptions}
        existingLegacyIds={[]}
        existingCanonicalIds={['cpm-1']}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options.some((t) => t?.includes('Yoke chart'))).toBe(false);
    expect(options.some((t) => t?.includes('Cabled Sweater'))).toBe(true);
  });

  it('does NOT render duplicate entries for a canonical with a legacy twin (regression — twin de-dupe lives in buildAvailablePatternOptions)', () => {
    // Modal trusts the parent to feed it pre-deduped options. Even so,
    // walking the rendered options must show each pattern exactly once
    // when the parent dedupes correctly. This pins the contract.
    const optionsAfterDedupe: PatternPickerOption[] = [
      { id: 'legacy-1', kind: 'legacy', name: 'Cabled Sweater', designer: 'Alice' },
      // The canonical twin of legacy-1 has been filtered out upstream.
    ];
    render(
      <AddPatternModal
        options={optionsAfterDedupe}
        existingLegacyIds={[]}
        existingCanonicalIds={[]}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    const matches = screen
      .getAllByRole('option')
      .filter((o) => o.textContent?.includes('Cabled Sweater'));
    expect(matches).toHaveLength(1);
    expect(matches[0].textContent).not.toMatch(/\(Designer\)/);
  });
});

describe('AddPatternModal — empty / no-selection edge cases', () => {
  it('does not submit when no pattern is selected', () => {
    const onSubmit = vi.fn();
    render(
      <AddPatternModal
        options={legacyOnly}
        existingLegacyIds={[]}
        existingCanonicalIds={[]}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByTestId('add-pattern-submit'));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
