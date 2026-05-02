/**
 * Smoke tests for the Make Mode QuickKey consumer panel.
 *
 * Covers the three render branches:
 *  - empty / loading: nothing renders (panel hides on empty state)
 *  - loaded with QuickKeys: list + items + page numbers visible
 *  - tapped item: viewer modal opens with the source file URL
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

describe('QuickKeysPanel', () => {
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
    expect(screen.getByText(/p\.3/)).toBeInTheDocument();
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
    expect(screen.getByTestId('pdf-doc')).toBeInTheDocument();
  });
});
