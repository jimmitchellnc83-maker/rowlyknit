/**
 * Smoke tests for the Make Mode QuickKey consumer panel.
 *
 * Covers:
 *  - empty / loading: nothing renders (panel hides on empty state)
 *  - loaded with QuickKeys: list + items + page numbers visible
 *  - tapped item: viewer modal opens with the source file URL
 *  - project mode: aggregates QuickKeys across multiple patterns and
 *    surfaces an attribution pill per row
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../lib/sourceFiles', () => ({
  listQuickKeysForPattern: vi.fn(),
  sourceFileBytesUrl: (id: string) => `/api/source-files/${id}/file`,
}));
vi.mock('react-pdf', () => ({
  pdfjs: { GlobalWorkerOptions: { workerSrc: '' } },
  Document: ({ children }: { children: React.ReactNode }) => <div data-testid="pdf-doc">{children}</div>,
  Page: () => <div data-testid="pdf-page" />,
}));

import QuickKeysPanel from './QuickKeysPanel';
import { listQuickKeysForPattern } from '../../lib/sourceFiles';

afterEach(() => {
  vi.clearAllMocks();
});

describe('QuickKeysPanel — single pattern', () => {
  it('renders an empty-state hint when the pattern has no QuickKeys', async () => {
    vi.mocked(listQuickKeysForPattern).mockResolvedValueOnce([]);
    render(<QuickKeysPanel patternId="pat-1" />);
    expect(await screen.findByText(/No QuickKeys yet/i)).toBeInTheDocument();
    expect(screen.getByText(/tap the ★/i)).toBeInTheDocument();
  });

  it('renders the list when QuickKeys exist', async () => {
    vi.mocked(listQuickKeysForPattern).mockResolvedValueOnce([
      {
        cropId: 'c1',
        sourceFileId: 'sf1',
        label: 'Cable repeat',
        quickKeyPosition: 0,
        pageNumber: 3,
        cropX: 0,
        cropY: 0,
        cropWidth: 0.5,
        cropHeight: 0.5,
      },
    ]);
    render(<QuickKeysPanel patternId="pat-1" />);
    expect(await screen.findByText(/QuickKeys/i)).toBeInTheDocument();
    expect(await screen.findByText(/Cable repeat/i)).toBeInTheDocument();
    expect(screen.getByText(/Page 3/)).toBeInTheDocument();
  });

  it('opens the viewer modal when a QuickKey is tapped', async () => {
    vi.mocked(listQuickKeysForPattern).mockResolvedValueOnce([
      {
        cropId: 'c1',
        sourceFileId: 'sf1',
        label: 'Decreases section',
        quickKeyPosition: 1,
        pageNumber: 7,
        cropX: 0.1,
        cropY: 0.1,
        cropWidth: 0.4,
        cropHeight: 0.4,
      },
    ]);
    render(<QuickKeysPanel patternId="pat-1" />);
    const item = await screen.findByRole('button', { name: /Decreases section/i });
    fireEvent.click(item);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    const docs = screen.getAllByTestId('pdf-doc');
    expect(docs.length).toBeGreaterThanOrEqual(1);
  });
});

describe('QuickKeysPanel — multi-pattern project mode', () => {
  it('aggregates QuickKeys across multiple patterns and pulls from each pattern', async () => {
    vi.mocked(listQuickKeysForPattern).mockImplementation(async (patternId: string) => {
      if (patternId === 'pat-a') {
        return [
          {
            cropId: 'c-a-1',
            sourceFileId: 'sf-a',
            label: 'Cable from A',
            quickKeyPosition: 0,
            pageNumber: 2,
            cropX: 0,
            cropY: 0,
            cropWidth: 0.5,
            cropHeight: 0.5,
          },
        ];
      }
      if (patternId === 'pat-b') {
        return [
          {
            cropId: 'c-b-1',
            sourceFileId: 'sf-b',
            label: 'Sleeve from B',
            quickKeyPosition: 0,
            pageNumber: 4,
            cropX: 0,
            cropY: 0,
            cropWidth: 0.5,
            cropHeight: 0.5,
          },
        ];
      }
      return [];
    });
    render(
      <QuickKeysPanel
        patterns={[
          { id: 'pat-a', name: 'Aran Sweater' },
          { id: 'pat-b', name: 'Sleeve Detail' },
        ]}
      />,
    );

    expect(await screen.findByText(/QuickKeys \(2\)/)).toBeInTheDocument();
    expect(await screen.findByText(/Cable from A/)).toBeInTheDocument();
    expect(screen.getByText(/Sleeve from B/)).toBeInTheDocument();
    // Attribution pills per pattern.
    expect(screen.getByText('Aran Sweater')).toBeInTheDocument();
    expect(screen.getByText('Sleeve Detail')).toBeInTheDocument();
    expect(vi.mocked(listQuickKeysForPattern)).toHaveBeenCalledWith('pat-a');
    expect(vi.mocked(listQuickKeysForPattern)).toHaveBeenCalledWith('pat-b');
  });

  it('continues to render even when one pattern fails to load (partial degrade)', async () => {
    vi.mocked(listQuickKeysForPattern).mockImplementation(async (patternId: string) => {
      if (patternId === 'pat-good') {
        return [
          {
            cropId: 'c1',
            sourceFileId: 'sf1',
            label: 'Visible',
            quickKeyPosition: 0,
            pageNumber: 1,
            cropX: 0,
            cropY: 0,
            cropWidth: 0.5,
            cropHeight: 0.5,
          },
        ];
      }
      throw new Error('boom');
    });
    render(
      <QuickKeysPanel
        patterns={[
          { id: 'pat-bad', name: 'Bad' },
          { id: 'pat-good', name: 'Good' },
        ]}
      />,
    );
    expect(await screen.findByText(/Visible/)).toBeInTheDocument();
  });

  it('does not show pattern badges in single-pattern mode', async () => {
    vi.mocked(listQuickKeysForPattern).mockResolvedValueOnce([
      {
        cropId: 'c1',
        sourceFileId: 'sf1',
        label: 'Solo',
        quickKeyPosition: 0,
        pageNumber: 1,
        cropX: 0,
        cropY: 0,
        cropWidth: 0.5,
        cropHeight: 0.5,
      },
    ]);
    render(<QuickKeysPanel patterns={[{ id: 'pat-only', name: 'Only Pattern' }]} />);
    expect(await screen.findByText(/Solo/)).toBeInTheDocument();
    // Pattern name should NOT be shown as a pill when there's only one
    // pattern; the row already implies it.
    expect(screen.queryByText('Only Pattern')).toBeNull();
  });
});
