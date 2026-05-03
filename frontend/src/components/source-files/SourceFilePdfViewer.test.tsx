/**
 * Coordinate-surface + responsive-layout tests for SourceFilePdfViewer.
 *
 * The viewer renders, per page, a header (page label + "Annotate page"
 * button) AND a PDF coordinate surface. The header MUST sit outside the
 * coordinate surface so pointer math, crop overlays, and chart-assistance
 * alignment never include the header's pixels — otherwise a crop drawn
 * at the visible top of the PDF starts below the header and chart grid
 * overlays sit at the wrong offset.
 *
 * The viewer is also responsive: it measures the scroll container with
 * ResizeObserver and feeds the result through `clampPageWidth` to set
 * the rendered page width. We exercise both branches.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';

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

const PageMock = vi.fn();

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
    Page: (props: { pageNumber: number; width?: number }) => {
      PageMock(props);
      return <canvas data-testid={`pdf-canvas-${props.pageNumber}`} data-width={props.width} />;
    },
  };
});

vi.mock('../../lib/pdfjsWorker', () => ({}));

import SourceFilePdfViewer, { clampPageWidth } from './SourceFilePdfViewer';
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
  createdAt: '2026-05-03T00:00:00Z',
  updatedAt: '2026-05-03T00:00:00Z',
  deletedAt: null,
};

afterEach(() => {
  vi.clearAllMocks();
  PageMock.mockClear();
});

describe('SourceFilePdfViewer coordinate surface', () => {
  it('renders the page header outside the PDF surface', async () => {
    render(<SourceFilePdfViewer sourceFile={SF} />);

    const surface1 = await screen.findByTestId('pdf-surface-1');
    const wrapper1 = screen.getByTestId('pdf-page-1');

    // The PDF surface is a child of the wrapper but the page label and
    // "Annotate page" button live in the wrapper — NOT inside the
    // surface. That's the structural guarantee that pointer math
    // ignores the header.
    expect(wrapper1.contains(surface1)).toBe(true);
    expect(surface1.querySelector('canvas')).not.toBeNull();

    const annotateButton = screen.getAllByRole('button', { name: /Annotate page/i })[0];
    expect(wrapper1.contains(annotateButton)).toBe(true);
    expect(surface1.contains(annotateButton)).toBe(false);

    const pageLabel = screen.getAllByText(/^Page 1$/)[0];
    expect(wrapper1.contains(pageLabel)).toBe(true);
    expect(surface1.contains(pageLabel)).toBe(false);
  });

  it('binds pointer events to the PDF surface, not the wrapper', async () => {
    render(<SourceFilePdfViewer sourceFile={SF} />);

    const surface1 = await screen.findByTestId('pdf-surface-1');
    const wrapper1 = screen.getByTestId('pdf-page-1');

    // Stub bounds: the wrapper is taller than the surface (header +
    // surface stacked). The crop math should read the surface bounds,
    // so a click at the visible top of the surface gives y=0.
    vi.spyOn(surface1, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 40, // header is 40px tall above
      width: 600,
      height: 800,
      right: 600,
      bottom: 840,
      x: 0,
      y: 40,
      toJSON() {
        return {};
      },
    });
    vi.spyOn(wrapper1, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 600,
      height: 840,
      right: 600,
      bottom: 840,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    });

    // Pointer-down at the visible top of the surface.
    const pointerEvent = (clientX: number, clientY: number) => ({
      clientX,
      clientY,
      button: 0,
      pointerId: 1,
    });

    let captured: DOMRect | null = null;
    const origGetBR = surface1.getBoundingClientRect;
    surface1.getBoundingClientRect = function () {
      const r = origGetBR.call(this);
      captured = r;
      return r;
    };

    await act(async () => {
      surface1.dispatchEvent(
        new (class extends Event {
          clientX: number;
          clientY: number;
          button: number;
          pointerId: number;
          constructor() {
            super('pointerdown', { bubbles: true });
            const ev = pointerEvent(0, 40);
            this.clientX = ev.clientX;
            this.clientY = ev.clientY;
            this.button = ev.button;
            this.pointerId = ev.pointerId;
          }
        })(),
      );
    });

    expect(captured).not.toBeNull();
    // Surface bounds, not wrapper bounds — top is 40 (the surface), not 0.
    expect(captured!.top).toBe(40);
    expect(captured!.height).toBe(800);
  });

  it('renders a surface for every page', async () => {
    render(<SourceFilePdfViewer sourceFile={SF} />);
    expect(await screen.findByTestId('pdf-surface-1')).toBeInTheDocument();
    expect(screen.getByTestId('pdf-surface-2')).toBeInTheDocument();
  });
});

describe('clampPageWidth (responsive bounds)', () => {
  it('floors at 320 so the page stays legible on a small phone', () => {
    expect(clampPageWidth(0)).toBe(600); // fallback when ResizeObserver hasn't fired yet
    expect(clampPageWidth(120)).toBe(320);
    expect(clampPageWidth(340)).toBe(320); // 340-32 = 308, still floored
  });

  it('scales with the container width once it is past the floor', () => {
    expect(clampPageWidth(500)).toBe(468); // 500-32
    expect(clampPageWidth(800)).toBe(768); // 800-32
  });

  it('caps at 900 so the rendered raster never blows up beyond legible width', () => {
    expect(clampPageWidth(1400)).toBe(900);
    expect(clampPageWidth(2400)).toBe(900);
  });
});
