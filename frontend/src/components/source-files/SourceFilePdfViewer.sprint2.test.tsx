/**
 * PDF Workspace Sprint 2 — viewer behavior tests.
 *
 * Locks the four user-visible contracts the sprint pinned:
 *   1. Reading mode is the default — non-fullpage saved crops do NOT
 *      render a loud purple bbox until the user enters Edit regions.
 *   2. Edit regions mode flips the bboxes back on with labels and
 *      tappable controls.
 *   3. Full-page "Annotate page" backing crops never appear as items
 *      in the crop sidebar list.
 *   4. Crops are grouped by page, labels don't truncate to ellipsis,
 *      and primary touch controls run at 44×44 minimum.
 *
 * Companion to the existing `SourceFilePdfViewer.test.tsx` which
 * pins the coordinate-surface invariants. Kept in a separate file so
 * the new mock — `listCropsForSourceFile` returning fixture crops —
 * doesn't bleed into the structural tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, act, fireEvent, within } from '@testing-library/react';

const FIXTURE_CROPS = [
  {
    id: 'crop-real-1',
    sourceFileId: 'sf-1',
    userId: 'u-1',
    patternId: null,
    patternSectionId: null,
    pageNumber: 1,
    cropX: 0.1,
    cropY: 0.1,
    cropWidth: 0.3,
    cropHeight: 0.2,
    label: 'Cable chart',
    chartId: null,
    isQuickKey: false,
    quickKeyPosition: null,
    metadata: {},
    createdAt: '2026-05-04T00:00:00Z',
    updatedAt: '2026-05-04T00:00:00Z',
    deletedAt: null,
  },
  {
    id: 'crop-fullpage-1',
    sourceFileId: 'sf-1',
    userId: 'u-1',
    patternId: null,
    patternSectionId: null,
    pageNumber: 1,
    cropX: 0,
    cropY: 0,
    cropWidth: 1,
    cropHeight: 1,
    label: 'Page 1 annotations',
    chartId: null,
    isQuickKey: false,
    quickKeyPosition: null,
    metadata: {},
    createdAt: '2026-05-04T00:00:01Z',
    updatedAt: '2026-05-04T00:00:01Z',
    deletedAt: null,
  },
  {
    id: 'crop-real-2',
    sourceFileId: 'sf-1',
    userId: 'u-1',
    patternId: null,
    patternSectionId: null,
    pageNumber: 2,
    cropX: 0.2,
    cropY: 0.3,
    cropWidth: 0.4,
    cropHeight: 0.1,
    label:
      'A really long descriptive label for this crop region that should not be truncated by a single-line ellipsis treatment because the whole point of Sprint 2 is to stop labels disappearing into p1 ellipsis',
    chartId: null,
    isQuickKey: true,
    quickKeyPosition: 1,
    metadata: {},
    createdAt: '2026-05-04T00:00:02Z',
    updatedAt: '2026-05-04T00:00:02Z',
    deletedAt: null,
  },
];

vi.mock('../../lib/sourceFiles', async () => {
  const actual = await vi.importActual<typeof import('../../lib/sourceFiles')>(
    '../../lib/sourceFiles',
  );
  return {
    ...actual,
    listCropsForSourceFile: vi.fn(async () => FIXTURE_CROPS),
    createCrop: vi.fn(),
    deleteCrop: vi.fn(),
    setCropQuickKey: vi.fn(),
    sourceFileBytesUrl: (id: string) => `/api/source-files/${id}/file`,
  };
});

vi.mock('react-pdf', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    pdfjs: { GlobalWorkerOptions: { workerSrc: '' } },
    Document: ({
      children,
      onLoadSuccess,
    }: {
      children: React.ReactNode;
      onLoadSuccess?: (args: { numPages: number }) => void;
    }) => {
      React.useEffect(() => {
        if (onLoadSuccess) onLoadSuccess({ numPages: 2 });
      }, [onLoadSuccess]);
      return <div data-testid="pdf-doc">{children}</div>;
    },
    Page: (props: { pageNumber: number; width?: number }) => (
      <canvas data-testid={`pdf-canvas-${props.pageNumber}`} data-width={props.width} />
    ),
  };
});

vi.mock('../../lib/pdfjsWorker', () => ({}));

// AnnotationLayer stub — we don't exercise canvas drawing here, just
// that mounting/unmounting follows the active-crop contract.
vi.mock('./AnnotationLayer', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation((props: { cropId: string }) => (
    <div data-testid={`annotation-layer-${props.cropId}`} />
  )),
}));

vi.mock('../wave5/ChartAssistanceModal', () => ({
  __esModule: true,
  default: () => <div data-testid="chart-assist-modal-mock" />,
}));

import SourceFilePdfViewer, { isFullPageCrop } from './SourceFilePdfViewer';
import type { SourceFile } from '../../lib/sourceFiles';

const SF: SourceFile = {
  id: 'sf-1',
  userId: 'u-1',
  craft: 'knit',
  kind: 'pattern_pdf',
  storageFilename: 'a'.repeat(32) + '.pdf',
  storageSubdir: 'patterns',
  originalFilename: 'pattern.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1234,
  pageCount: 2,
  pageDimensions: null,
  parseStatus: 'parsed',
  parseError: null,
  createdAt: '2026-05-04T00:00:00Z',
  updatedAt: '2026-05-04T00:00:00Z',
  deletedAt: null,
};

beforeEach(() => {
  // findByTestId polls long enough for the mocked listCropsForSourceFile
  // promise to settle and the viewer to re-render with crops in state.
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('isFullPageCrop helper', () => {
  it('returns true for (0,0,1,1) rectangles', () => {
    expect(
      isFullPageCrop({
        ...FIXTURE_CROPS[1],
      }),
    ).toBe(true);
  });

  it('returns false for any rectangle that is not exactly the unit square', () => {
    expect(isFullPageCrop({ ...FIXTURE_CROPS[0] })).toBe(false);
    expect(
      isFullPageCrop({
        ...FIXTURE_CROPS[1],
        cropWidth: 0.999,
      }),
    ).toBe(false);
  });
});

describe('Reading mode (default) — calm overlays', () => {
  it('does NOT render the loud purple bbox styling for saved non-fullpage crops by default', async () => {
    render(<SourceFilePdfViewer sourceFile={SF} />);

    // Wait for the fixture crops to land in state.
    const overlay = await screen.findByTestId('crop-overlay-crop-real-1');
    expect(overlay.dataset.loud).toBe('false');
    // The wrapper class must not include the loud border-2 + bg combo.
    expect(overlay.className).not.toContain('border-2');
    expect(overlay.className).not.toContain('bg-purple-200');
  });

  it('hides the crop label badge in reading mode', async () => {
    render(<SourceFilePdfViewer sourceFile={SF} />);
    await screen.findByTestId('crop-overlay-crop-real-1');
    // The on-page floating label badge ("Cable chart" rendered as a
    // purple chip above the bbox) only shows in edit mode.
    expect(
      document.querySelector(
        '[data-testid="crop-overlay-crop-real-1"] .bg-purple-600',
      ),
    ).toBeNull();
  });

  it('keeps fullpage backing crops as invisible mount points (no purple bbox)', async () => {
    render(<SourceFilePdfViewer sourceFile={SF} />);
    const overlay = await screen.findByTestId('crop-overlay-crop-fullpage-1');
    expect(overlay.dataset.fullpage).toBe('true');
    expect(overlay.className).not.toContain('border-2');
  });
});

describe('Edit regions mode — full purple boxes restored', () => {
  it('flips overlays back to the loud purple bbox + label badge when toggled', async () => {
    render(<SourceFilePdfViewer sourceFile={SF} />);
    const toggle = await screen.findByTestId('regions-mode-toggle');
    expect(toggle.dataset.mode).toBe('hidden');

    await act(async () => {
      fireEvent.click(toggle);
    });

    const refreshedToggle = screen.getByTestId('regions-mode-toggle');
    expect(refreshedToggle.dataset.mode).toBe('visible');

    const overlay = screen.getByTestId('crop-overlay-crop-real-1');
    expect(overlay.dataset.loud).toBe('true');
    expect(overlay.className).toContain('border-2');

    // Label badge appears now ("Cable chart" in a purple chip).
    expect(overlay.querySelector('.bg-purple-600')?.textContent).toBe('Cable chart');
  });

  it('still leaves fullpage backing crops as invisible mount points in edit mode', async () => {
    render(<SourceFilePdfViewer sourceFile={SF} />);
    const toggle = await screen.findByTestId('regions-mode-toggle');
    await act(async () => {
      fireEvent.click(toggle);
    });
    const fullpage = screen.getByTestId('crop-overlay-crop-fullpage-1');
    expect(fullpage.dataset.fullpage).toBe('true');
    expect(fullpage.dataset.loud).toBe('false');
  });

  it('exposes the Delete control only in edit mode', async () => {
    render(<SourceFilePdfViewer sourceFile={SF} />);
    await screen.findByTestId('crop-item-crop-real-1');
    expect(screen.queryAllByLabelText('Delete crop')).toHaveLength(0);

    const toggle = screen.getByTestId('regions-mode-toggle');
    await act(async () => {
      fireEvent.click(toggle);
    });

    const deleteButtons = screen.getAllByLabelText('Delete crop');
    // Two real crops → two delete buttons.
    expect(deleteButtons).toHaveLength(2);
  });
});

describe('Crop sidebar — full-page filtering, grouping, labels', () => {
  it('does not render fullpage backing crops as crop-list entries', async () => {
    render(<SourceFilePdfViewer sourceFile={SF} />);
    await screen.findByTestId('crop-sidebar');
    expect(screen.queryByTestId('crop-item-crop-fullpage-1')).toBeNull();
    expect(screen.getByTestId('crop-item-crop-real-1')).toBeInTheDocument();
    expect(screen.getByTestId('crop-item-crop-real-2')).toBeInTheDocument();
  });

  it('reports the count of real crops only (excludes fullpage backing crops)', async () => {
    render(<SourceFilePdfViewer sourceFile={SF} />);
    const sidebar = await screen.findByTestId('crop-sidebar');
    // 2 real crops + 1 fullpage backing → count must read 2.
    expect(within(sidebar).getByText('Crops (2)')).toBeInTheDocument();
  });

  it('groups crops under their page subheader and surfaces an "Annotated" badge for pages with full-page annotations', async () => {
    render(<SourceFilePdfViewer sourceFile={SF} />);
    const group1 = await screen.findByTestId('crop-group-1');
    const group2 = await screen.findByTestId('crop-group-2');

    // Subheaders.
    expect(within(group1).getByText('Page 1')).toBeInTheDocument();
    expect(within(group2).getByText('Page 2')).toBeInTheDocument();

    // Page 1 has both a real crop AND a fullpage annotation backing →
    // the "Annotated" badge surfaces that without polluting the list.
    expect(within(group1).getByText('Annotated')).toBeInTheDocument();
    expect(within(group2).queryByText('Annotated')).toBeNull();

    // Each crop lives under its group.
    expect(within(group1).getByTestId('crop-item-crop-real-1')).toBeInTheDocument();
    expect(within(group2).getByTestId('crop-item-crop-real-2')).toBeInTheDocument();
  });

  it('does not truncate long labels with ellipsis — they wrap instead', async () => {
    render(<SourceFilePdfViewer sourceFile={SF} />);
    const item = await screen.findByTestId('crop-item-crop-real-2');
    const labelEl = within(item).getByText(/A really long descriptive label/);
    // No "truncate" utility on the label span.
    expect(labelEl.className).not.toContain('truncate');
    expect(labelEl.className).toContain('break-words');
  });

  it('uses an italic "Unlabeled region" placeholder rather than a curt "unlabeled"', async () => {
    const { listCropsForSourceFile } = await import('../../lib/sourceFiles');
    (listCropsForSourceFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { ...FIXTURE_CROPS[0], id: 'unlabeled-1', label: null },
    ]);
    render(<SourceFilePdfViewer sourceFile={{ ...SF, id: 'sf-2' }} />);
    const item = await screen.findByTestId('crop-item-unlabeled-1');
    expect(within(item).getByText('Unlabeled region')).toBeInTheDocument();
  });
});

describe('44px touch targets — primary controls', () => {
  it('the regions-mode toggle is a 44px-min button', async () => {
    render(<SourceFilePdfViewer sourceFile={SF} />);
    const toggle = await screen.findByTestId('regions-mode-toggle');
    expect(toggle.className).toContain('min-h-[44px]');
  });

  it('the QuickKey, chart-assist, and (in edit mode) Delete buttons are 44×44 minimum', async () => {
    render(<SourceFilePdfViewer sourceFile={SF} />);
    await screen.findByTestId('crop-item-crop-real-1');

    // QuickKey + chart-assist always show.
    const quickKeyButtons = screen.getAllByLabelText(/QuickKey/);
    expect(quickKeyButtons.length).toBeGreaterThan(0);
    for (const btn of quickKeyButtons) {
      expect(btn.className).toContain('min-h-[44px]');
      expect(btn.className).toContain('min-w-[44px]');
    }

    const chartAssistButtons = screen.getAllByLabelText('Open chart assistance');
    expect(chartAssistButtons.length).toBe(2);
    for (const btn of chartAssistButtons) {
      expect(btn.className).toContain('min-h-[44px]');
      expect(btn.className).toContain('min-w-[44px]');
    }

    // Delete shows after switching to edit mode.
    await act(async () => {
      fireEvent.click(screen.getByTestId('regions-mode-toggle'));
    });
    const deleteButtons = screen.getAllByLabelText('Delete crop');
    for (const btn of deleteButtons) {
      expect(btn.className).toContain('min-h-[44px]');
      expect(btn.className).toContain('min-w-[44px]');
    }
  });

  it('the per-page "Annotate page" button is 44px-min so it stays tappable on iPad', async () => {
    render(<SourceFilePdfViewer sourceFile={SF} />);
    const buttons = await screen.findAllByRole('button', { name: /Annotate page/i });
    expect(buttons.length).toBe(2);
    for (const btn of buttons) {
      expect(btn.className).toContain('min-h-[44px]');
    }
  });
});
