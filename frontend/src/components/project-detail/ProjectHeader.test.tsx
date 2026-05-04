/**
 * ProjectHeader regression coverage.
 *
 * - Make-this-again duplicate button (existing).
 * - Sprint 2: unified Make Mode entry. Project Detail must offer ONE
 *   primary path into knitting work that prefers the canonical pattern_models
 *   surface when available, with a picker when the project has multiple
 *   patterns. Legacy "Resume Knitting" stays as the secondary action (and
 *   as the only action when no pattern has a canonical twin).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProjectHeader from './ProjectHeader';

vi.mock('../../lib/featureFlags', () => ({
  isDesignerMakeModeEnabled: vi.fn(() => true),
}));

import { isDesignerMakeModeEnabled } from '../../lib/featureFlags';

function defaultProps(overrides: Partial<Parameters<typeof ProjectHeader>[0]> = {}) {
  return {
    projectId: 'p-1',
    project: { name: 'Cabled Cardigan', status: 'active', project_type: 'cardigan' },
    patterns: [],
    selectedRecipient: undefined,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onShare: vi.fn(),
    onDuplicate: vi.fn(),
    duplicating: false,
    isPublic: false,
    ...overrides,
  } as Parameters<typeof ProjectHeader>[0];
}

function renderHeader(props: Parameters<typeof ProjectHeader>[0]) {
  return render(
    <MemoryRouter initialEntries={[`/projects/${props.projectId}`]}>
      <Routes>
        <Route
          path="/projects/:id"
          element={<ProjectHeader {...props} />}
        />
        <Route
          path="/patterns/:id/make"
          element={<div data-testid="make-mode-page">Make Mode</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(isDesignerMakeModeEnabled).mockReturnValue(true);
});

describe('ProjectHeader Make-this-again button', () => {
  it('renders the button with the marketing label', () => {
    renderHeader(defaultProps());
    expect(screen.getByRole('button', { name: /make this again/i })).toBeInTheDocument();
  });

  it('calls onDuplicate when clicked', () => {
    const onDuplicate = vi.fn();
    renderHeader(defaultProps({ onDuplicate }));
    fireEvent.click(screen.getByRole('button', { name: /make this again/i }));
    expect(onDuplicate).toHaveBeenCalledTimes(1);
  });

  it('shows "Copying…" and disables while duplicating', () => {
    const onDuplicate = vi.fn();
    renderHeader(defaultProps({ onDuplicate, duplicating: true }));
    const btn = screen.getByRole('button', { name: /copying/i });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onDuplicate).not.toHaveBeenCalled();
  });
});

describe('ProjectHeader unified Make Mode entry', () => {
  it('hides Open in Make Mode and shows the legacy Resume Knitting label when no patterns are attached', () => {
    renderHeader(defaultProps({ patterns: [] }));
    expect(screen.queryByTestId('project-open-make-mode')).not.toBeInTheDocument();
    expect(screen.getByTestId('project-toggle-workspace')).toHaveTextContent(/resume knitting/i);
  });

  it('hides Open in Make Mode when patterns have no canonical twin', () => {
    renderHeader(
      defaultProps({
        patterns: [
          { id: 'pat-legacy-1', name: 'Legacy PDF', canonicalPatternModelId: null },
          { id: 'pat-legacy-2', name: 'Another legacy', canonicalPatternModelId: null },
        ],
      }),
    );
    expect(screen.queryByTestId('project-open-make-mode')).not.toBeInTheDocument();
    expect(screen.getByTestId('project-toggle-workspace')).toHaveTextContent(/resume knitting/i);
  });

  it('hides Open in Make Mode when the flag is off, even with a canonical twin', () => {
    vi.mocked(isDesignerMakeModeEnabled).mockReturnValue(false);
    renderHeader(
      defaultProps({
        patterns: [
          { id: 'pat-1', name: 'Sweater', canonicalPatternModelId: 'cpm-1' },
        ],
      }),
    );
    expect(screen.queryByTestId('project-open-make-mode')).not.toBeInTheDocument();
    expect(screen.getByTestId('project-toggle-workspace')).toHaveTextContent(/resume knitting/i);
  });

  it('routes directly to canonical Make Mode only when the project has exactly one pattern AND it has a twin', () => {
    renderHeader(
      defaultProps({
        patterns: [
          { id: 'pat-1', name: 'Sweater', canonicalPatternModelId: 'cpm-1' },
        ],
      }),
    );
    const cta = screen.getByTestId('project-open-make-mode');
    expect(cta).toBeInTheDocument();
    fireEvent.click(cta);
    expect(screen.getByTestId('make-mode-page')).toBeInTheDocument();
    // No picker dialog ever appeared on the way through.
    expect(screen.queryByTestId('make-mode-picker-list')).not.toBeInTheDocument();
  });

  it('opens the picker when the project has multiple canonical patterns (N≥2 canonical)', () => {
    renderHeader(
      defaultProps({
        patterns: [
          { id: 'pat-1', name: 'Body chart', canonicalPatternModelId: 'cpm-1' },
          { id: 'pat-2', name: 'Sleeve chart', canonicalPatternModelId: 'cpm-2' },
        ],
      }),
    );
    fireEvent.click(screen.getByTestId('project-open-make-mode'));
    const picker = screen.getByTestId('make-mode-picker-list');
    expect(picker).toBeInTheDocument();
    expect(screen.getAllByTestId('make-mode-picker-canonical-row')).toHaveLength(2);
    expect(screen.getByText('Body chart')).toBeInTheDocument();
    expect(screen.getByText('Sleeve chart')).toBeInTheDocument();
  });

  it('opens the picker (NOT direct-navigates) when the project has multiple patterns but only one has a canonical twin', () => {
    // Regression: previously, canonicalCount === 1 routed directly to
    // the twin even when the project had additional legacy-only
    // patterns, hiding them. Now we always show the picker for
    // multi-pattern projects so legacy-only siblings stay visible
    // (rendered as disabled rows).
    renderHeader(
      defaultProps({
        patterns: [
          { id: 'pat-1', name: 'Body chart', canonicalPatternModelId: 'cpm-1' },
          { id: 'pat-2', name: 'Sleeve PDF', canonicalPatternModelId: null },
        ],
      }),
    );
    fireEvent.click(screen.getByTestId('project-open-make-mode'));
    // Picker opened — direct-navigate did NOT fire.
    expect(screen.getByTestId('make-mode-picker-list')).toBeInTheDocument();
    expect(screen.queryByTestId('make-mode-page')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('make-mode-picker-canonical-row')).toHaveLength(1);
    const legacyRows = screen.getAllByTestId('make-mode-picker-legacy-row');
    expect(legacyRows).toHaveLength(1);
    expect(legacyRows[0]).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Body chart')).toBeInTheDocument();
    expect(screen.getByText('Sleeve PDF')).toBeInTheDocument();
  });

  it('keeps Project workspace as a secondary action alongside canonical CTA', () => {
    renderHeader(
      defaultProps({
        patterns: [
          { id: 'pat-1', name: 'Sweater', canonicalPatternModelId: 'cpm-1' },
        ],
      }),
    );
    expect(screen.getByTestId('project-open-make-mode')).toBeInTheDocument();
    expect(screen.getByTestId('project-toggle-workspace')).toHaveTextContent(/project workspace/i);
  });

  it('shows mixed canonical + legacy patterns in the picker, with legacy rows disabled', () => {
    renderHeader(
      defaultProps({
        patterns: [
          { id: 'pat-1', name: 'Body chart', canonicalPatternModelId: 'cpm-1' },
          { id: 'pat-2', name: 'Body chart', canonicalPatternModelId: 'cpm-2' },
          { id: 'pat-3', name: 'Vintage PDF', canonicalPatternModelId: null },
        ],
      }),
    );
    fireEvent.click(screen.getByTestId('project-open-make-mode'));
    expect(screen.getAllByTestId('make-mode-picker-canonical-row')).toHaveLength(2);
    const legacyRows = screen.getAllByTestId('make-mode-picker-legacy-row');
    expect(legacyRows).toHaveLength(1);
    expect(legacyRows[0]).toHaveAttribute('aria-disabled', 'true');
    expect(legacyRows[0]).toHaveTextContent(/legacy pattern/i);
  });
});

/**
 * Auth + Launch Polish Sprint 2026-05-04 — responsive header layout.
 *
 * The previous header was a single `flex justify-between` row that
 * collided around ~900px because the actions row had grown to 7
 * buttons; the title text was the casualty. The new layout stacks
 * title / subtext / actions like the Designer header. Every action
 * button must clear a 44px touch target on every breakpoint, and the
 * actions row must be a flex container that wraps freely (so on a
 * narrow viewport buttons fall to the next visual line instead of
 * spilling horizontally and cropping).
 *
 * jsdom has no real layout, so we lock the contract via class-regex
 * matchers.
 */
describe('ProjectHeader responsive layout (Designer-style stack)', () => {
  it('uses a stacked column header that never asks title and actions to share the same row', () => {
    renderHeader(defaultProps());

    const header = screen.getByTestId('project-header');
    expect(header.className).toMatch(/\bflex-col\b/);
    // No `flex-row` on small screens — the actions toolbar moves to its
    // own row, away from the title.
    expect(header.className).not.toMatch(/(^|\s)flex-row(\s|$)/);
  });

  it('puts title + status pill in their own row', () => {
    renderHeader(defaultProps());
    const titleRow = screen.getByTestId('project-header-title');
    expect(titleRow.className).toMatch(/\bflex-wrap\b/);
    expect(titleRow).toHaveTextContent(/cabled cardigan/i);
    expect(titleRow).toHaveTextContent(/active/i);
  });

  it('puts every action button in a single wrapping toolbar row', () => {
    renderHeader(
      defaultProps({
        patterns: [{ id: 'pat-1', name: 'Sweater', canonicalPatternModelId: 'cpm-1' }],
      }),
    );
    const actions = screen.getByTestId('project-header-actions');
    expect(actions.className).toMatch(/\bflex\b/);
    expect(actions.className).toMatch(/\bflex-wrap\b/);
    // Spot-check: every primary CTA renders inside the toolbar row.
    expect(actions).toContainElement(screen.getByTestId('project-open-make-mode'));
    expect(actions).toContainElement(screen.getByTestId('project-toggle-workspace'));
  });

  it('every primary action button clears a 44px touch target', () => {
    renderHeader(
      defaultProps({
        patterns: [{ id: 'pat-1', name: 'Sweater', canonicalPatternModelId: 'cpm-1' }],
      }),
    );

    // Lock min-h-[44px] specifically (not 36px or 40px) on every
    // primary CTA in the toolbar row. We don't sweep ALL buttons under
    // the actions container because HelpTooltip mounts a tiny help-icon
    // trigger that is intentionally smaller — it's not a primary
    // touch target. Locking the 6 user-driven buttons by their text /
    // testid is what matters. Codex review on PR #381 flagged primary
    // controls below 44px as a regression hazard.
    const primaryButtons = [
      screen.getByTestId('project-open-make-mode'),
      screen.getByTestId('project-toggle-workspace'),
      screen.getByRole('button', { name: /share|public/i }),
      screen.getByRole('button', { name: /make this again/i }),
      screen.getByRole('button', { name: /^edit$/i }),
      screen.getByRole('button', { name: /^delete$/i }),
    ];

    for (const btn of primaryButtons) {
      // The `[` in the arbitrary-value class isn't a word char, so use
      // a whitespace/start/end anchor instead of `\b`.
      expect(btn.className).toMatch(/(^|\s)min-h-\[44px\](\s|$)/);
    }
  });
});
