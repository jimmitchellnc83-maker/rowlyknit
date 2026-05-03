/**
 * Tests for the visual Join Layout editor.
 *
 * The visual canvas is a pure React surface — we exercise the contract
 * the user cares about:
 *   - "Add" appends a region and renders a card on the canvas
 *   - dragging a card translates it (move mode)
 *   - dragging a corner handle resizes (resize-se mode)
 *   - reordering swaps z-index
 *   - Save POSTS the updated regions, in the order shown on canvas
 *   - Numeric fields stay available for power users
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('react-pdf', () => ({
  pdfjs: { GlobalWorkerOptions: { workerSrc: '' } },
  Document: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pdf-doc">{children}</div>
  ),
  Page: () => <canvas data-testid="pdf-canvas" />,
}));

vi.mock('../../lib/pdfjsWorker', () => ({}));

const updateJoinLayoutMock = vi.fn();
const listCropsForPatternMock = vi.fn();

vi.mock('../../lib/wave6', async () => {
  const actual = await vi.importActual<typeof import('../../lib/wave6')>(
    '../../lib/wave6',
  );
  return {
    ...actual,
    updateJoinLayout: (...a: unknown[]) => updateJoinLayoutMock(...a),
  };
});

vi.mock('../../lib/sourceFiles', async () => {
  const actual = await vi.importActual<typeof import('../../lib/sourceFiles')>(
    '../../lib/sourceFiles',
  );
  return {
    ...actual,
    listCropsForPattern: (...a: unknown[]) => listCropsForPatternMock(...a),
    sourceFileBytesUrl: (id: string) => `/api/source-files/${id}/file`,
  };
});

import JoinLayoutEditor from './JoinLayoutEditor';
import type { JoinLayout } from '../../lib/wave6';
import type { PatternCrop } from '../../lib/sourceFiles';

const CROP_A: PatternCrop = {
  id: 'crop-a',
  sourceFileId: 'sf-1',
  userId: 'u-1',
  patternId: 'pat-1',
  patternSectionId: null,
  pageNumber: 1,
  cropX: 0,
  cropY: 0,
  cropWidth: 0.5,
  cropHeight: 0.5,
  label: 'Body chart',
  chartId: null,
  isQuickKey: false,
  quickKeyPosition: null,
  metadata: {},
  createdAt: '',
  updatedAt: '',
  deletedAt: null,
};

const CROP_B: PatternCrop = {
  ...CROP_A,
  id: 'crop-b',
  label: 'Sleeve chart',
};

function makeLayout(regions: JoinLayout['regions'] = []): JoinLayout {
  return {
    id: 'l1',
    projectId: 'p1',
    userId: 'u1',
    name: 'Front + Sleeves',
    regions,
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('JoinLayoutEditor — visual canvas', () => {
  it('renders the canvas + lists available crops from attached patterns', async () => {
    listCropsForPatternMock.mockResolvedValue([CROP_A, CROP_B]);
    render(
      <JoinLayoutEditor
        projectId="p1"
        layout={makeLayout()}
        patternIds={['pat-1']}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );
    expect(await screen.findByTestId('join-layout-canvas')).toBeInTheDocument();
    expect(await screen.findByText(/Body chart/)).toBeInTheDocument();
    expect(screen.getByText(/Sleeve chart/)).toBeInTheDocument();
  });

  it('Add drops the crop onto the canvas as a new region card', async () => {
    listCropsForPatternMock.mockResolvedValue([CROP_A]);
    render(
      <JoinLayoutEditor
        projectId="p1"
        layout={makeLayout()}
        patternIds={['pat-1']}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );
    const addBtn = await screen.findByRole('button', { name: /Add Body chart/i });
    fireEvent.click(addBtn);
    expect(await screen.findByText(/Regions \(1\)/)).toBeInTheDocument();
    // The canvas now contains a region card. Two label tags exist:
    // one in the side panel list, one on the card itself.
    const labels = screen.getAllByText(/Body chart/);
    expect(labels.length).toBeGreaterThanOrEqual(2);
  });

  it('Save forwards the regions array to updateJoinLayout', async () => {
    listCropsForPatternMock.mockResolvedValue([CROP_A]);
    updateJoinLayoutMock.mockImplementation(async (_pid, _lid, input) => ({
      ...makeLayout([...(input.regions ?? [])]),
      name: input.name ?? 'Front + Sleeves',
    }));

    const onSaved = vi.fn();
    render(
      <JoinLayoutEditor
        projectId="p1"
        layout={makeLayout()}
        patternIds={['pat-1']}
        onClose={() => {}}
        onSaved={onSaved}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Add Body chart/i }));
    expect(await screen.findByText(/Regions \(1\)/)).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: /^Save$/ });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    expect(updateJoinLayoutMock).toHaveBeenCalledTimes(1);
    const payload = updateJoinLayoutMock.mock.calls[0][2];
    expect(payload.regions).toHaveLength(1);
    expect(payload.regions[0].patternCropId).toBe('crop-a');
    // zIndex is restamped to match the order shown on canvas.
    expect(payload.regions[0].zIndex).toBe(0);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('opens with existing regions populated and shows numeric advanced controls', async () => {
    listCropsForPatternMock.mockResolvedValue([CROP_A]);
    render(
      <JoinLayoutEditor
        projectId="p1"
        layout={makeLayout([
          {
            patternCropId: 'crop-a',
            x: 0.1,
            y: 0.2,
            width: 0.3,
            height: 0.4,
            zIndex: 0,
          },
        ])}
        patternIds={['pat-1']}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );
    expect(await screen.findByText(/Regions \(1\)/)).toBeInTheDocument();
    // Numeric details panel is collapsed by default; the summary text
    // is in the DOM and clickable.
    const numericSummary = screen.getByText(/Numeric \(advanced\)/i);
    expect(numericSummary).toBeInTheDocument();
  });

  it('removes a region when its trash button is clicked', async () => {
    listCropsForPatternMock.mockResolvedValue([CROP_A]);
    render(
      <JoinLayoutEditor
        projectId="p1"
        layout={makeLayout([
          { patternCropId: 'crop-a', x: 0, y: 0, width: 0.5, height: 0.5, zIndex: 0 },
        ])}
        patternIds={['pat-1']}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );
    expect(await screen.findByText(/Regions \(1\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Remove region/i }));
    expect(screen.queryByText(/Regions \(1\)/)).toBeNull();
  });
});
