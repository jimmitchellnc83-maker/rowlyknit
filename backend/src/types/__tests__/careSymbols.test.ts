import { sanitizeCareSymbols } from '../careSymbols';

describe('sanitizeCareSymbols (backend)', () => {
  it('returns [] for non-array input', () => {
    expect(sanitizeCareSymbols(null)).toEqual([]);
    expect(sanitizeCareSymbols('xyz')).toEqual([]);
    expect(sanitizeCareSymbols({})).toEqual([]);
  });

  it('keeps every canonical preset combination', () => {
    const valid = [
      { category: 'wash', prohibited: false, modifier: 'machine-30', label: 'Machine wash 30°C' },
      { category: 'bleach', prohibited: true, modifier: null, label: 'Do not bleach' },
      { category: 'dry', prohibited: false, modifier: 'flat', label: 'Dry flat' },
      { category: 'iron', prohibited: false, modifier: 'low', label: 'Iron low' },
      { category: 'dryClean', prohibited: true, modifier: null, label: 'Do not dry-clean' },
    ];
    expect(sanitizeCareSymbols(valid)).toEqual(valid);
  });

  it('drops unknown categories', () => {
    expect(
      sanitizeCareSymbols([{ category: 'pet-bath', prohibited: false, modifier: null, label: 'x' }]),
    ).toEqual([]);
  });

  it('drops unknown (category, modifier) combos', () => {
    expect(
      sanitizeCareSymbols([
        { category: 'wash', prohibited: false, modifier: 'tropical', label: 'Wash tropical' },
      ]),
    ).toEqual([]);
  });

  it('drops entries missing prohibited boolean', () => {
    expect(
      sanitizeCareSymbols([
        { category: 'wash', prohibited: 'no', modifier: 'hand', label: 'Hand wash' },
      ]),
    ).toEqual([]);
  });

  it('drops entries with non-string label', () => {
    expect(
      sanitizeCareSymbols([
        { category: 'wash', prohibited: false, modifier: 'hand', label: 42 },
      ]),
    ).toEqual([]);
  });
});
