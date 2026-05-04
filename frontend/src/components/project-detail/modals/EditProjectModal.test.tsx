/**
 * QA sprint 2026-05-04: pre-fix the modal silently swallowed save errors
 * (`catch {}`), so a 500 from the API left the user staring at the same
 * unchanged form with no feedback. These tests pin:
 *
 * - successful submit closes the modal.
 * - server-supplied error messages render in the alert banner.
 * - a thrown plain Error renders a sensible fallback.
 * - retrying after an error clears the previous banner before the next call.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditProjectModal from './EditProjectModal';

const baseProject = {
  name: 'Test Project',
  description: 'd',
  status: 'active',
  notes: '',
  recipient_id: '',
};

describe('EditProjectModal error handling', () => {
  it('closes on successful submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <EditProjectModal
        project={baseProject}
        availableRecipients={[]}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('shows the server-supplied error message inside the form when submit rejects', async () => {
    const onSubmit = vi.fn().mockRejectedValue({
      response: { data: { message: 'Project name already taken' } },
    });
    const onClose = vi.fn();
    render(
      <EditProjectModal
        project={baseProject}
        availableRecipients={[]}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Project name already taken');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('falls back to a generic message when the error has no message at all', async () => {
    const onSubmit = vi.fn().mockRejectedValue({});
    render(
      <EditProjectModal
        project={baseProject}
        availableRecipients={[]}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/could not save changes/i);
  });

  it('clears a stale error banner when the user retries', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce({ response: { data: { message: 'Boom' } } })
      .mockResolvedValueOnce(undefined);
    const onClose = vi.fn();
    render(
      <EditProjectModal
        project={baseProject}
        availableRecipients={[]}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await screen.findByText('Boom');
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(screen.queryByText('Boom')).not.toBeInTheDocument();
  });
});
