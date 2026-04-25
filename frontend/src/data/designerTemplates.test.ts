import { describe, it, expect } from 'vitest';
import {
  DESIGNER_TEMPLATES,
  MEASUREMENT_FIELD_KEYS,
  mergeTemplateIntoForm,
} from './designerTemplates';

describe('DESIGNER_TEMPLATES catalog', () => {
  it('has unique ids', () => {
    const ids = DESIGNER_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has at least one template per supported itemType', () => {
    const supported = ['sweater', 'hat', 'scarf', 'blanket', 'shawl', 'mittens', 'socks'];
    for (const t of supported) {
      const count = DESIGNER_TEMPLATES.filter((tmpl) => tmpl.itemType === t).length;
      expect(count, `expected at least one template for ${t}`).toBeGreaterThan(0);
    }
  });

  it('every template has name + description + non-empty fields', () => {
    for (const t of DESIGNER_TEMPLATES) {
      expect(t.name.length, `${t.id} name`).toBeGreaterThan(0);
      expect(t.description.length, `${t.id} description`).toBeGreaterThan(0);
      expect(Object.keys(t.fields).length, `${t.id} fields`).toBeGreaterThan(0);
    }
  });

  it('all measurement field values are positive numbers', () => {
    for (const t of DESIGNER_TEMPLATES) {
      for (const [k, v] of Object.entries(t.fields)) {
        if (MEASUREMENT_FIELD_KEYS.has(k)) {
          expect(typeof v, `${t.id}.${k} type`).toBe('number');
          expect(v as number, `${t.id}.${k} value`).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

function makeForm(unit: 'in' | 'cm') {
  return {
    unit,
    gaugeStitches: 22 as number | '',
    gaugeRows: 30 as number | '',
    gaugeMeasurement: 4 as number | '',
    itemType: 'sweater',
    colors: [{ id: 'mc', label: 'Main', hex: '#abcdef' }],
    chart: null,
    // Pre-existing measurement values that should get overwritten:
    chestCircumference: 99,
    headCircumference: 99,
  };
}

describe('mergeTemplateIntoForm', () => {
  const beanie = DESIGNER_TEMPLATES.find((t) => t.id === 'hat-adult-beanie')!;
  const fitted = DESIGNER_TEMPLATES.find((t) => t.id === 'sweater-adult-fitted')!;
  const triangle = DESIGNER_TEMPLATES.find((t) => t.id === 'shawl-triangle')!;

  it('keeps inch values unchanged when form is in inches', () => {
    const out = mergeTemplateIntoForm(beanie, makeForm('in'));
    expect(out.itemType).toBe('hat');
    expect((out as { headCircumference: number }).headCircumference).toBe(22);
    expect((out as { hatTotalHeight: number }).hatTotalHeight).toBe(9);
    expect((out as { hatBrimDepth: number }).hatBrimDepth).toBe(2);
  });

  it('converts inch values to cm when form is in cm mode', () => {
    const out = mergeTemplateIntoForm(beanie, makeForm('cm'));
    // 22 in × 2.54 = 55.88 → rounds to 56 (nearest 0.25)
    expect((out as { headCircumference: number }).headCircumference).toBe(56);
    // 9 in × 2.54 = 22.86 → rounds to 22.75
    expect((out as { hatTotalHeight: number }).hatTotalHeight).toBe(22.75);
    // 2 in × 2.54 = 5.08 → rounds to 5
    expect((out as { hatBrimDepth: number }).hatBrimDepth).toBe(5);
  });

  it('preserves user gauge, colors, chart, and unit', () => {
    const form = makeForm('cm');
    const out = mergeTemplateIntoForm(beanie, form);
    expect(out.unit).toBe('cm');
    expect(out.gaugeStitches).toBe(22);
    expect(out.gaugeRows).toBe(30);
    expect(out.gaugeMeasurement).toBe(4);
    expect(out.colors).toBe(form.colors);
    expect(out.chart).toBeNull();
  });

  it('does not convert booleans or enum strings', () => {
    const out = mergeTemplateIntoForm(fitted, makeForm('cm'));
    expect((out as { useWaistShaping: boolean }).useWaistShaping).toBe(true);
    expect((out as { useArmhole: boolean }).useArmhole).toBe(true);
    expect((out as { panelType: string }).panelType).toBe('front');
  });

  it('does not convert stitch counts (shawlInitialCastOn)', () => {
    const out = mergeTemplateIntoForm(triangle, makeForm('cm'));
    expect((out as { shawlInitialCastOn: number }).shawlInitialCastOn).toBe(7);
  });

  it('overwrites the matching itemType section without leaking previous values', () => {
    const out = mergeTemplateIntoForm(beanie, makeForm('in'));
    expect(out.itemType).toBe('hat');
    // Sweater fields stay (the form has them all together) but the hat
    // measurements have been replaced with template values.
    expect((out as { headCircumference: number }).headCircumference).toBe(22);
    // chestCircumference wasn't in the hat template's fields, so it
    // remains at the form's value (this is correct — the form holds all
    // itemType field families and switching itemType doesn't wipe them).
    expect((out as { chestCircumference: number }).chestCircumference).toBe(99);
  });
});
