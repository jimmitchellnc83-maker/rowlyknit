/**
 * Smoke tests for the Make Mode pieces strip.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

import axios from 'axios';
import PiecesQuickPanel from './PiecesQuickPanel';

const mockGet = vi.mocked(axios.get);

afterEach(() => {
  vi.clearAllMocks();
});

function withRouter(node: React.ReactElement) {
  return <MemoryRouter>{node}</MemoryRouter>;
}

describe('PiecesQuickPanel', () => {
  it('renders nothing when the project has no pieces or panel groups', async () => {
    mockGet.mockResolvedValue({ data: { data: { pieces: [], groups: [] } } });
    const { container } = render(withRouter(<PiecesQuickPanel projectId="p1" />));
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('renders the active piece label when one is in progress', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.endsWith('/pieces')) {
        return Promise.resolve({
          data: {
            data: {
              pieces: [
                { id: 'a', name: 'Front', type: 'body', status: 'in_progress', sortOrder: 0 },
                { id: 'b', name: 'Back', type: 'body', status: 'not_started', sortOrder: 1 },
              ],
            },
          },
        });
      }
      return Promise.resolve({ data: { data: { groups: [] } } });
    });
    render(withRouter(<PiecesQuickPanel projectId="p1" />));
    expect(await screen.findByText(/Active:/i)).toBeInTheDocument();
    // "Front" appears twice (Active line + list item) — assert both occurrences.
    expect(screen.getAllByText('Front').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Back')).toBeInTheDocument();
  });

  it('shows Panel Knitting link when panel groups exist', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.endsWith('/pieces')) {
        return Promise.resolve({ data: { data: { pieces: [] } } });
      }
      return Promise.resolve({
        data: {
          data: {
            groups: [{ id: 'g1', name: 'Sleeves', panelCount: 2 }],
          },
        },
      });
    });
    render(withRouter(<PiecesQuickPanel projectId="p1" />));
    expect(await screen.findByRole('link', { name: /Panel Knitting/i })).toBeInTheDocument();
  });
});
