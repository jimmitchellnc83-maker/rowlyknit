/**
 * Responsive layout contract for SourceFilesPanel.
 *
 * Codex review on PR #369 flagged that the parent that hosts the PDF
 * viewer was still wrapping it in a fixed horizontal layout with a
 * 224px file rail, so on tablet/mobile the PDF surface still got
 * squeezed even though the viewer itself was responsive. The fix
 * stacks the rail above the viewer below the `lg` breakpoint and
 * keeps the side rail on desktop. jsdom has no real layout, so we
 * can't measure pixels — instead we lock the responsive class
 * contract so a future style change can't silently regress it.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';

const listSourceFilesMock = vi.fn();
const uploadSourceFileMock = vi.fn();
const deleteSourceFileMock = vi.fn();

vi.mock('../../lib/sourceFiles', async () => {
  const actual = await vi.importActual<typeof import('../../lib/sourceFiles')>(
    '../../lib/sourceFiles',
  );
  return {
    ...actual,
    listSourceFiles: (...a: unknown[]) => listSourceFilesMock(...a),
    uploadSourceFile: (...a: unknown[]) => uploadSourceFileMock(...a),
    deleteSourceFile: (...a: unknown[]) => deleteSourceFileMock(...a),
    sourceFileBytesUrl: (id: string) => `/api/source-files/${id}/file`,
  };
});

vi.mock('../../lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

// SourceFilePdfViewer pulls in react-pdf which loads a worker; stub it
// out so this test stays focused on the panel's wrapper layout.
vi.mock('./SourceFilePdfViewer', () => ({
  __esModule: true,
  default: () => <div data-testid="pdf-viewer-stub" />,
}));

import SourceFilesPanel from './SourceFilesPanel';
import type { SourceFile } from '../../lib/sourceFiles';

function makeFile(id: string, name: string): SourceFile {
  return {
    id,
    userId: 'u-1',
    craft: 'knit',
    kind: 'pattern_pdf',
    storageFilename: 'a'.repeat(32) + '.pdf',
    storageSubdir: 'patterns',
    originalFilename: name,
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    pageCount: 4,
    pageDimensions: null,
    parseStatus: 'parsed',
    parseError: null,
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('SourceFilesPanel responsive layout', () => {
  it('stacks rail above viewer on small screens, side-by-side on large', async () => {
    listSourceFilesMock.mockResolvedValueOnce([
      makeFile('a', 'first.pdf'),
      makeFile('b', 'second.pdf'),
    ]);
    render(<SourceFilesPanel patternId="pat-1" />);
    await act(async () => {
      await Promise.resolve();
    });

    const layout = await screen.findByTestId('source-files-layout');
    // Below `lg` the wrapper stacks; from `lg` up it sits side-by-side.
    expect(layout.className).toMatch(/\bflex-col\b/);
    expect(layout.className).toMatch(/\blg:flex-row\b/);

    const rail = screen.getByTestId('source-files-rail');
    // The rail itself flips from a horizontal scrolling chip strip on
    // small screens to a vertical sidebar on large screens.
    expect(rail.className).toMatch(/\bflex\b/);
    expect(rail.className).toMatch(/\blg:flex-col\b/);
    expect(rail.className).toMatch(/\boverflow-x-auto\b/);
    expect(rail.className).toMatch(/\blg:overflow-y-auto\b/);
    expect(rail.className).toMatch(/\blg:w-56\b/);
  });

  it('keeps file switching, upload, and shared badge intact', async () => {
    listSourceFilesMock.mockResolvedValueOnce([
      { ...makeFile('a', 'shared.pdf'), attachmentCount: 3 },
      makeFile('b', 'solo.pdf'),
    ]);
    render(<SourceFilesPanel patternId="pat-1" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(await screen.findByText('shared.pdf')).toBeInTheDocument();
    expect(screen.getByText('solo.pdf')).toBeInTheDocument();
    // Shared badge fires for files attached to >1 pattern.
    expect(screen.getByText('Shared')).toBeInTheDocument();
    // Upload affordance still mounts.
    expect(screen.getByRole('button', { name: /Upload/i })).toBeInTheDocument();
    // Delete button still mounts per file.
    expect(screen.getAllByLabelText('Delete file').length).toBe(2);
  });
});
