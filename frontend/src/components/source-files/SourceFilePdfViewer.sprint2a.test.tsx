/**
 * PDF Workspace Bugfix Sprint 2A — viewer behavior tests.
 *
 * Pins three regressions caught in the post-PR377 review:
 *   1. QuickKey toggle MUST send a small integer position, not a
 *      `Date.now()` millisecond timestamp. Postgres `quickkey_position`
 *      is an int32 column — timestamps overflow it and 500 every toggle.
 *   2. `nextQuickKeyPosition` returns `max(existing) + 1`, falling back
 *      to 0 when no QuickKeys exist.
 *   3. The crop sidebar surfaces a "Page N + Annotated" group for pages
 *      whose ONLY backing crop is a (0,0,1,1) annotation full-page crop,
 *      so a knitter who only used "Annotate page" can still find the
 *      page via the sidebar.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, act, fireEvent, within } from '@testing-library/react';

const REAL_CROP = {
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
};

const FULLPAGE_CROP_PAGE_2 = {
  id: 'crop-fullpage-p2',
  sourceFileId: 'sf-1',
  userId: 'u-1',
  patternId: null,
  patternSectionId: null,
  pageNumber: 2,
  cropX: 0,
  cropY: 0,
  cropWidth: 1,
  cropHeight: 1,
  label: 'Page 2 annotations',
  chartId: null,
  isQuickKey: false,
  quickKeyPosition: null,
  metadata: {},
  createdAt: '2026-05-04T00:00:01Z',
  updatedAt: '2026-05-04T00:00:01Z',
  deletedAt: null,
};

const QK_AT_POS_2 = {
  ...REAL_CROP,
  id: 'crop-real-qk2',
  pageNumber: 1,
  cropX: 0.5,
  cropY: 0.5,
  cropWidth: 0.2,
  cropHeight: 0.1,
  label: 'Already-pinned region',
  isQuickKey: true,
  quickKeyPosition: 2,
};

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

// Default mock — most tests overwrite `listCropsForSourceFile` for their
// specific fixture set via `mockResolvedValueOnce`.
vi.mock('../../lib/sourceFiles', async () => {
  const actual = await vi.importActual<typeof import('../../lib/sourceFiles')>(
    '../../lib/sourceFiles',
  );
  return {
    ...actual,
    listCropsForSourceFile: vi.fn(async () => []),
    createCrop: vi.fn(),
    deleteCrop: vi.fn(),
    setCropQuickKey: vi.fn(),
    sourceFileBytesUrl: (id: string) => `/api/source-files/${id}/file`,
  };
});

import SourceFilePdfViewer, {
  nextQuickKeyPosition,
} from './SourceFilePdfViewer';
import type { PatternCrop, SourceFile } from '../../lib/sourceFiles';

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

afterEach(() => {
  vi.clearAllMocks();
});

describe('nextQuickKeyPosition helper', () => {
  it('returns 0 when no crops have QuickKey set', () => {
    expect(nextQuickKeyPosition([])).toBe(0);
    expect(
      nextQuickKeyPosition([{ ...REAL_CROP, isQuickKey: false } as PatternCrop]),
    ).toBe(0);
  });

  it('returns max + 1 when QuickKeys exist', () => {
    const crops: PatternCrop[] = [
      { ...REAL_CROP, id: 'a', isQuickKey: true, quickKeyPosition: 0 } as PatternCrop,
      { ...REAL_CROP, id: 'b', isQuickKey: true, quickKeyPosition: 2 } as PatternCrop,
      { ...REAL_CROP, id: 'c', isQuickKey: true, quickKeyPosition: 1 } as PatternCrop,
    ];
    expect(nextQuickKeyPosition(crops)).toBe(3);
  });

  it('ignores non-QuickKey rows even when they carry a stale quickKeyPosition', () => {
    const crops: PatternCrop[] = [
      { ...REAL_CROP, id: 'a', isQuickKey: true, quickKeyPosition: 5 } as PatternCrop,
      { ...REAL_CROP, id: 'b', isQuickKey: false, quickKeyPosition: 99 } as PatternCrop,
    ];
    expect(nextQuickKeyPosition(crops)).toBe(6);
  });

  it('produces a small int well under the int32 ceiling', () => {
    const crops: PatternCrop[] = [
      { ...REAL_CROP, isQuickKey: true, quickKeyPosition: 0 } as PatternCrop,
    ];
    const next = nextQuickKeyPosition(crops);
    expect(Number.isInteger(next)).toBe(true);
    expect(next).toBeLessThan(2_147_483_647);
    // A `Date.now()` ms timestamp would be ~1.78e12 — fail loud if any
    // future regression brings that back.
    expect(next).toBeLessThan(1_000_000);
  });
});

describe('handleToggleQuickKey payload — int32-safe positions', () => {
  it('sends position 0 when toggling ON the first QuickKey', async () => {
    const sourceFiles = await import('../../lib/sourceFiles');
    const list = sourceFiles.listCropsForSourceFile as unknown as ReturnType<
      typeof vi.fn
    >;
    list.mockResolvedValueOnce([REAL_CROP]);
    const setCropQuickKey = sourceFiles.setCropQuickKey as unknown as ReturnType<
      typeof vi.fn
    >;
    setCropQuickKey.mockResolvedValueOnce({
      isQuickKey: true,
      quickKeyPosition: 0,
      label: 'Cable chart',
    });

    render(<SourceFilePdfViewer sourceFile={SF} />);
    const button = await screen.findByLabelText('Save as QuickKey');
    await act(async () => {
      fireEvent.click(button);
    });

    expect(setCropQuickKey).toHaveBeenCalledTimes(1);
    const args = setCropQuickKey.mock.calls[0];
    expect(args[0]).toBe('sf-1');
    expect(args[1]).toBe('crop-real-1');
    expect(args[2]).toEqual({ isQuickKey: true, position: 0 });
    // Hard-fail if anyone reintroduces Date.now() ordering.
    expect(args[2].position).toBeLessThan(1_000_000);
  });

  it('sends max(existing) + 1 when other QuickKeys already exist', async () => {
    const sourceFiles = await import('../../lib/sourceFiles');
    const list = sourceFiles.listCropsForSourceFile as unknown as ReturnType<
      typeof vi.fn
    >;
    // REAL_CROP is the toggle target (not yet a QK); QK_AT_POS_2 is an
    // already-pinned region at position 2. Next position must be 3.
    list.mockResolvedValueOnce([REAL_CROP, QK_AT_POS_2]);
    const setCropQuickKey = sourceFiles.setCropQuickKey as unknown as ReturnType<
      typeof vi.fn
    >;
    setCropQuickKey.mockResolvedValueOnce({
      isQuickKey: true,
      quickKeyPosition: 3,
      label: 'Cable chart',
    });

    render(<SourceFilePdfViewer sourceFile={SF} />);
    const buttons = await screen.findAllByLabelText('Save as QuickKey');
    // The non-QK target is the first; the already-pinned one shows
    // "Remove from QuickKeys" instead.
    await act(async () => {
      fireEvent.click(buttons[0]);
    });

    expect(setCropQuickKey).toHaveBeenCalledTimes(1);
    expect(setCropQuickKey.mock.calls[0][2]).toEqual({
      isQuickKey: true,
      position: 3,
    });
  });

  it('sends position null when toggling OFF', async () => {
    const sourceFiles = await import('../../lib/sourceFiles');
    const list = sourceFiles.listCropsForSourceFile as unknown as ReturnType<
      typeof vi.fn
    >;
    list.mockResolvedValueOnce([QK_AT_POS_2]);
    const setCropQuickKey = sourceFiles.setCropQuickKey as unknown as ReturnType<
      typeof vi.fn
    >;
    setCropQuickKey.mockResolvedValueOnce({
      isQuickKey: false,
      quickKeyPosition: null,
      label: 'Already-pinned region',
    });

    render(<SourceFilePdfViewer sourceFile={SF} />);
    const removeBtn = await screen.findByLabelText('Remove from QuickKeys');
    await act(async () => {
      fireEvent.click(removeBtn);
    });

    expect(setCropQuickKey).toHaveBeenCalledTimes(1);
    expect(setCropQuickKey.mock.calls[0][2]).toEqual({
      isQuickKey: false,
      position: null,
    });
  });
});

describe('Crop sidebar — annotation-only pages get a Page N + Annotated entry', () => {
  it('shows a "Page 2 + Annotated" group when the page has ONLY a full-page annotation crop and no real crops', async () => {
    const sourceFiles = await import('../../lib/sourceFiles');
    const list = sourceFiles.listCropsForSourceFile as unknown as ReturnType<
      typeof vi.fn
    >;
    // Page 1 has a real crop + (intentionally) no full-page annotation.
    // Page 2 has ONLY a full-page backing crop. The sidebar must still
    // show "Page 2 + Annotated" so the knitter can find their page.
    list.mockResolvedValueOnce([REAL_CROP, FULLPAGE_CROP_PAGE_2]);

    render(<SourceFilePdfViewer sourceFile={SF} />);

    const group2 = await screen.findByTestId('crop-group-2');
    expect(within(group2).getByText('Page 2')).toBeInTheDocument();
    expect(within(group2).getByText('Annotated')).toBeInTheDocument();

    // The full-page backing crop never renders as a crop list item.
    expect(screen.queryByTestId('crop-item-crop-fullpage-p2')).toBeNull();
    // Page 1 still has its real crop.
    expect(screen.getByTestId('crop-item-crop-real-1')).toBeInTheDocument();
  });

  it('keeps the empty state copy ONLY when there are zero real crops AND zero annotated pages', async () => {
    const sourceFiles = await import('../../lib/sourceFiles');
    const list = sourceFiles.listCropsForSourceFile as unknown as ReturnType<
      typeof vi.fn
    >;
    list.mockResolvedValueOnce([]);

    render(<SourceFilePdfViewer sourceFile={SF} />);
    const sidebar = await screen.findByTestId('crop-sidebar');
    expect(
      within(sidebar).getByText(/Drag a rectangle on a page/i),
    ).toBeInTheDocument();
  });

  it('shows Page N + Annotated and NO empty state when annotation-only pages exist', async () => {
    const sourceFiles = await import('../../lib/sourceFiles');
    const list = sourceFiles.listCropsForSourceFile as unknown as ReturnType<
      typeof vi.fn
    >;
    list.mockResolvedValueOnce([FULLPAGE_CROP_PAGE_2]);

    render(<SourceFilePdfViewer sourceFile={SF} />);
    const sidebar = await screen.findByTestId('crop-sidebar');
    // Empty state must NOT show now — we have an annotated page to surface.
    expect(within(sidebar).queryByText(/Drag a rectangle on a page/i)).toBeNull();
    const group2 = await screen.findByTestId('crop-group-2');
    expect(within(group2).getByText('Annotated')).toBeInTheDocument();
  });

  it('keeps real-crop + full-page-crop pages working: shows the badge AND the real crop list item', async () => {
    const sourceFiles = await import('../../lib/sourceFiles');
    const list = sourceFiles.listCropsForSourceFile as unknown as ReturnType<
      typeof vi.fn
    >;
    // Page 1 has a real crop AND a full-page annotation crop.
    const fullpageP1 = { ...FULLPAGE_CROP_PAGE_2, id: 'crop-fullpage-p1', pageNumber: 1 };
    list.mockResolvedValueOnce([REAL_CROP, fullpageP1]);

    render(<SourceFilePdfViewer sourceFile={SF} />);
    const group1 = await screen.findByTestId('crop-group-1');
    expect(within(group1).getByText('Page 1')).toBeInTheDocument();
    expect(within(group1).getByText('Annotated')).toBeInTheDocument();
    // Real crop renders inside the same group.
    expect(within(group1).getByTestId('crop-item-crop-real-1')).toBeInTheDocument();
    // Full-page backing crop never renders as a crop list item.
    expect(screen.queryByTestId('crop-item-crop-fullpage-p1')).toBeNull();
  });
});
