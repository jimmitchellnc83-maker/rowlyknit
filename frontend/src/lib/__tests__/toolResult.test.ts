/**
 * Tests for templateTypeFor — Sprint 1 Public Tools Conversion.
 */

import { describe, it, expect } from 'vitest';
import { templateTypeFor } from '../toolResult';

describe('templateTypeFor', () => {
  it('gauge → project = calculator_result, gauge → pattern = gauge_swatch', () => {
    expect(templateTypeFor('gauge', 'project')).toBe('calculator_result');
    expect(templateTypeFor('gauge', 'pattern')).toBe('gauge_swatch');
  });

  it('size always maps to fit_adjustment', () => {
    expect(templateTypeFor('size', 'project')).toBe('fit_adjustment');
    expect(templateTypeFor('size', 'pattern')).toBe('fit_adjustment');
  });

  it('yardage → stash = stash_estimate, yardage → project = yardage_estimate', () => {
    expect(templateTypeFor('yardage', 'stash')).toBe('stash_estimate');
    expect(templateTypeFor('yardage', 'project')).toBe('yardage_estimate');
  });

  it('row-repeat → make-mode = make_mode_reminder, row-repeat → project = row_repeat_plan', () => {
    expect(templateTypeFor('row-repeat', 'make-mode')).toBe('make_mode_reminder');
    expect(templateTypeFor('row-repeat', 'project')).toBe('row_repeat_plan');
  });

  it('shaping → make-mode = make_mode_reminder, shaping → project = shaping_plan', () => {
    expect(templateTypeFor('shaping', 'make-mode')).toBe('make_mode_reminder');
    expect(templateTypeFor('shaping', 'project')).toBe('shaping_plan');
  });

  it('returned values must all be in the backend ALLOWED_TEMPLATE_TYPES enum', () => {
    // Mirror the backend list as a contract test — keep this list in sync
    // with backend/src/routes/notes.ts ALLOWED_TEMPLATE_TYPES.
    const ALLOWED = new Set([
      'gauge_swatch',
      'fit_adjustment',
      'yarn_substitution',
      'finishing',
      'finishing_techniques',
      'calculator_result',
      'yardage_estimate',
      'stash_estimate',
      'row_repeat_plan',
      'shaping_plan',
      'make_mode_reminder',
    ]);
    const tools = ['gauge', 'size', 'yardage', 'row-repeat', 'shaping'] as const;
    const targets = ['project', 'pattern', 'stash', 'make-mode'] as const;
    for (const tool of tools) {
      for (const target of targets) {
        expect(ALLOWED.has(templateTypeFor(tool, target))).toBe(true);
      }
    }
  });
});
