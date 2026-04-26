import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import BodySchematic from './BodySchematic';
import HatSchematic from './HatSchematic';
import RectSchematic from './RectSchematic';
import {
  computeBodyBlock,
  computeHat,
  type BodyBlockInput,
  type HatInput,
  type DesignerGauge,
} from '../../utils/designerMath';

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

  it('BodySchematic tints fill + stroke with the supplied mainColor', () => {
    const input: BodyBlockInput = {
      gauge: GAUGE,
      chestCircumference: 36,
      easeAtChest: 4,
      totalLength: 24,
      hemDepth: 2,
    };
    const { container } = render(
      <BodySchematic
        input={input}
        output={computeBodyBlock(input)}
        unit="in"
        mainColor="#DC2626"
      />,
    );
    const path = container.querySelector('path');
    expect(path?.getAttribute('fill')).toBe('#DC2626');
    // Stroke should be a darker shade derived from the main color (not the
    // hardcoded fallback purple).
    const stroke = path?.getAttribute('stroke') ?? '';
    expect(stroke.toLowerCase()).not.toBe('#7c3aed');
  });

  it('BodySchematic falls back to the default purple when no mainColor is set', () => {
    const input: BodyBlockInput = {
      gauge: GAUGE,
      chestCircumference: 36,
      easeAtChest: 4,
      totalLength: 24,
      hemDepth: 2,
    };
    const { container } = render(
      <BodySchematic input={input} output={computeBodyBlock(input)} unit="in" />,
    );
    const path = container.querySelector('path');
    expect(path?.getAttribute('fill')).toBe('#F5F3FF');
    expect(path?.getAttribute('stroke')).toBe('#7C3AED');
  });

  it('BodySchematic scales maxWidth with the zoom prop', () => {
    const input: BodyBlockInput = {
      gauge: GAUGE,
      chestCircumference: 36,
      easeAtChest: 4,
      totalLength: 24,
      hemDepth: 2,
    };
    const { container, rerender } = render(
      <BodySchematic input={input} output={computeBodyBlock(input)} unit="in" zoom={1} />,
    );
    const svg1 = container.querySelector('svg')!;
    expect(svg1.getAttribute('style')).toContain('max-width: 24rem');

    rerender(<BodySchematic input={input} output={computeBodyBlock(input)} unit="in" zoom={2} />);
    const svg2 = container.querySelector('svg')!;
    expect(svg2.getAttribute('style')).toContain('max-width: 48rem');
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
