import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import CustomDraftSchematic from './CustomDraftSchematic';
import { computeCustomDraft, type DesignerGauge } from '../../utils/designerMath';
import type { CustomDraft } from '../../types/customDraft';
import type { ChartData } from './ChartGrid';

const GAUGE: DesignerGauge = { stitchesPer4in: 20, rowsPer4in: 28 };

const SIMPLE_DRAFT: CustomDraft = {
  craftMode: 'hand',
  startingStitches: 80,
  sections: [
    { id: '1', name: 'Ribbing', type: 'ribbing', rows: 12, changePerSide: 0, note: '' },
    { id: '2', name: 'Body', type: 'straight', rows: 60, changePerSide: 0, note: '' },
  ],
};

describe('CustomDraftSchematic', () => {
  it('renders the silhouette path when sections + rows exist', () => {
    const out = computeCustomDraft({ draft: SIMPLE_DRAFT, gauge: GAUGE });
    const { container } = render(
      <CustomDraftSchematic output={out} unit="in" />,
    );
    const path = container.querySelector('path');
    expect(path).not.toBeNull();
  });

  it('shows a placeholder when the draft has no sections', () => {
    const empty = computeCustomDraft({
      draft: { ...SIMPLE_DRAFT, sections: [] },
      gauge: GAUGE,
    });
    const { container } = render(<CustomDraftSchematic output={empty} unit="in" />);
    expect(container.textContent).toContain('Add at least one section');
  });

  it('labels cast-on stitches', () => {
    const out = computeCustomDraft({ draft: SIMPLE_DRAFT, gauge: GAUGE });
    const { container } = render(<CustomDraftSchematic output={out} unit="in" />);
    expect(container.textContent).toContain('80 sts (cast on)');
  });

  it('shows total rows + height in the user unit', () => {
    const out = computeCustomDraft({ draft: SIMPLE_DRAFT, gauge: GAUGE });
    const { container: inEl } = render(<CustomDraftSchematic output={out} unit="in" />);
    expect(inEl.textContent).toMatch(/72 rows/);
    // 72 rows / 7 rows/in = ~10.25 in
    expect(inEl.textContent).toMatch(/10\.25 in total/);

    const { container: cmEl } = render(<CustomDraftSchematic output={out} unit="cm" />);
    // 10.25 in × 2.54 = 26.04, rounds to 26 cm
    expect(cmEl.textContent).toMatch(/26 cm total/);
  });

  it('tiles colored chart cells when colorwork is present', () => {
    const out = computeCustomDraft({ draft: SIMPLE_DRAFT, gauge: GAUGE });
    const chart: ChartData = {
      width: 1,
      height: 1,
      cells: [{ symbolId: null, colorHex: '#ff0000' }],
    };
    const { container } = render(
      <CustomDraftSchematic output={out} unit="in" chart={chart} />,
    );
    const colorRects = Array.from(container.querySelectorAll('rect[fill="#ff0000"]'));
    expect(colorRects.length).toBeGreaterThan(0);
  });
});
