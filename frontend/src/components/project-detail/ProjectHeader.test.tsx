import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProjectHeader from './ProjectHeader';

function defaultProps(overrides: Partial<Parameters<typeof ProjectHeader>[0]> = {}) {
  return {
    projectId: 'p-1',
    project: { name: 'Cabled Cardigan', status: 'active', project_type: 'cardigan' },
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
    <MemoryRouter>
      <ProjectHeader {...props} />
    </MemoryRouter>,
  );
}

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
