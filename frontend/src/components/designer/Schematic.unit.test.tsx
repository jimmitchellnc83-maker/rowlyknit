import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import HatSchematic from './HatSchematic';
import RectSchematic from './RectSchematic';
import { computeHat, type HatInput, type DesignerGauge } from '../../utils/designerMath';

const GAUGE: DesignerGauge = { stitchesPer4in: 20, rowsPer4in: 28 };

const HAT_INPUT: HatInput = {
  gauge: GAUGE,
  headCircumference: 22,
  negativeEaseAtBrim: 1,
  totalHeight: 8,
  brimDepth: 2,
  crownHeight: 2,
};

describe('schematic unit prop', () => {
  it('HatSchematic shows inch suffix when unit=in', () => {
    const { container } = render(<HatSchematic output={computeHat(HAT_INPUT)} unit="in" />);
    const text = container.textContent ?? '';
    expect(text).toMatch(/\bin\b/);
    expect(text).not.toMatch(/\bcm\b/);
  });

  it('HatSchematic shows cm suffix and converted value when unit=cm', () => {
    const out = computeHat(HAT_INPUT);
    const { container } = render(<HatSchematic output={out} unit="cm" />);
    const text = container.textContent ?? '';
    expect(text).toMatch(/\bcm\b/);
    expect(text).not.toMatch(/\d+ in\b/);
    const expectedCm = String(Math.round(out.finishedCircumference * 2.54 * 2) / 2);
    expect(text).toContain(expectedCm);
  });

  it('RectSchematic shows correct unit suffix on width/length labels', () => {
    const { container: inContainer } = render(
      <RectSchematic
        label="Scarf"
        accent="purple"
        widthInches={8}
        lengthInches={60}
        castOnStitches={40}
        unit="in"
      />,
    );
    expect(inContainer.textContent).toMatch(/8 in wide/);
    expect(inContainer.textContent).toMatch(/60 in long/);

    const { container: cmContainer } = render(
      <RectSchematic
        label="Scarf"
        accent="purple"
        widthInches={8}
        lengthInches={60}
        castOnStitches={40}
        unit="cm"
      />,
    );
    expect(cmContainer.textContent).toMatch(/20\.5 cm wide/);
    expect(cmContainer.textContent).toMatch(/152\.5 cm long/);
  });
});
