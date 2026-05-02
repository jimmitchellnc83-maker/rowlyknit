/**
 * Smoke test for the Wave 6 Layouts & Pages section.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../lib/wave6', async () => {
  const actual = await vi.importActual<typeof import('../../lib/wave6')>('../../lib/wave6');
  return {
    ...actual,
    listJoinLayouts: vi.fn(),
    listBlankPages: vi.fn(),
    createJoinLayout: vi.fn(),
    createBlankPage: vi.fn(),
    deleteJoinLayout: vi.fn(),
    deleteBlankPage: vi.fn(),
    updateBlankPage: vi.fn(),
  };
});

import LayoutsAndPagesSection from './LayoutsAndPagesSection';
import {
  listBlankPages,
  listJoinLayouts,
} from '../../lib/wave6';

afterEach(() => {
  vi.clearAllMocks();
});

describe('LayoutsAndPagesSection', () => {
  it('renders the empty state when nothing exists yet', async () => {
    vi.mocked(listJoinLayouts).mockResolvedValueOnce([]);
    vi.mocked(listBlankPages).mockResolvedValueOnce([]);
    render(<LayoutsAndPagesSection projectId="p1" />);
    expect(await screen.findByRole('heading', { name: /Join layouts/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Blank pages/i })).toBeInTheDocument();
    expect(screen.getAllByText(/No (layouts|blank pages) yet/).length).toBe(2);
  });

  it('renders existing layouts + pages with their counts', async () => {
    vi.mocked(listJoinLayouts).mockResolvedValueOnce([
      {
        id: 'l1',
        projectId: 'p1',
        userId: 'u1',
        name: 'Front + Sleeves',
        regions: [{ patternCropId: 'c1', x: 0, y: 0, width: 0.5, height: 0.5 }],
        createdAt: '',
        updatedAt: '',
        deletedAt: null,
      },
    ]);
    vi.mocked(listBlankPages).mockResolvedValueOnce([
      {
        id: 'b1',
        projectId: 'p1',
        userId: 'u1',
        name: 'Schematic sketch',
        craft: 'knit',
        width: 8.5,
        height: 11,
        aspectKind: 'letter',
        strokes: [],
        createdAt: '',
        updatedAt: '',
        deletedAt: null,
      },
    ]);
    render(<LayoutsAndPagesSection projectId="p1" />);
    expect(await screen.findByText(/Front \+ Sleeves/)).toBeInTheDocument();
    expect(screen.getByText(/Schematic sketch/)).toBeInTheDocument();
    expect(screen.getByText(/1 region/)).toBeInTheDocument();
  });
});
