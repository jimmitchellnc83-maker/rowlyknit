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

  it('routes directly to canonical Make Mode for single-pattern + twin (N=1)', () => {
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

  it('opens the picker when the project has multiple canonical patterns (N≥2)', () => {
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
