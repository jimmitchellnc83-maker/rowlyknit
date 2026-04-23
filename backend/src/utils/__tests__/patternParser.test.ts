import { normalizeText, parsePatternText } from '../patternParser';

describe('normalizeText', () => {
  it('converts curly quotes to straight', () => {
    expect(normalizeText('\u201Chello\u201D')).toBe('"hello"');
    expect(normalizeText("it\u2019s")).toBe("it's");
  });
  it('collapses tabs and em-dashes', () => {
    expect(normalizeText('row 1\t\u2014 knit')).toBe('row 1 - knit');
  });
  it('normalizes CRLF to LF', () => {
    expect(normalizeText('a\r\nb')).toBe('a\nb');
  });
  it('replaces non-breaking spaces', () => {
    expect(normalizeText('Row\u00A01: K')).toBe('Row 1: K');
  });
});

describe('parsePatternText - single panel', () => {
  it('parses a simple 4-row cable', () => {
    const text = [
      'Row 1: K2, P2, C4F, P2, K2',
      'Row 2: P2, K2, P4, K2, P2',
      'Row 3: K2, P2, K4, P2, K2',
      'Row 4: P2, K2, P4, K2, P2',
    ].join('\n');
    const result = parsePatternText(text);
    expect(result.panels).toHaveLength(1);
    const panel = result.panels[0];
    expect(panel.repeat_length).toBe(4);
    expect(panel.rows).toHaveLength(4);
    expect(panel.rows[0].instruction).toBe('K2, P2, C4F, P2, K2');
    expect(panel.warnings).toEqual([]);
  });

  it('parses "Rnd" round notation', () => {
    const text = 'Rnd 1: knit\nRnd 2: purl\nRnd 3: knit\nRnd 4: purl';
    const r = parsePatternText(text);
    expect(r.panels[0].repeat_length).toBe(4);
  });

  it('parses bare-number "1: knit" form', () => {
    const r = parsePatternText('1: knit\n2: purl\n3: knit\n4: purl');
    expect(r.panels[0].repeat_length).toBe(4);
    expect(r.panels[0].rows[0].confidence).toBe(0.85); // bare is lower confidence
  });

  it('parses a range "Rows 1-4: knit"', () => {
    const r = parsePatternText('Rows 1-4: knit');
    expect(r.panels).toHaveLength(1);
    expect(r.panels[0].repeat_length).toBe(4);
    expect(r.panels[0].rows).toHaveLength(4);
    expect(r.panels[0].rows.every((row) => row.instruction === 'knit')).toBe(true);
  });

  it('parses multi-row "Rows 1 and 3: knit" with gap warning', () => {
    const r = parsePatternText('Rows 1 and 3: knit\nRows 2 and 4: purl');
    expect(r.panels[0].repeat_length).toBe(4);
    expect(r.panels[0].rows).toHaveLength(4);
    // Every row was explicitly covered; no warnings.
    expect(r.panels[0].warnings).toEqual([]);
  });

  it('flags gaps when only odd rows are defined', () => {
    const r = parsePatternText('Row 1: knit\nRow 3: purl\nRow 5: knit');
    expect(r.panels[0].repeat_length).toBe(5);
    expect(r.panels[0].warnings[0]).toMatch(/Rows 2, 4/);
    // Placeholders inserted at the gap positions.
    expect(r.panels[0].rows).toHaveLength(5);
    expect(r.panels[0].rows[1].instruction).toBe('');
    expect(r.panels[0].rows[1].confidence).toBe(0);
  });
});

describe('parsePatternText - multi-panel', () => {
  it('detects sections separated by blank lines', () => {
    const text = [
      'Row 1: K2, P2',
      'Row 2: P2, K2',
      '',
      '',
      'Row 1: (K1, P1) to end',
      'Row 2: (P1, K1) to end',
    ].join('\n');
    const r = parsePatternText(text);
    expect(r.panels).toHaveLength(2);
    expect(r.panels[0].suggested_name).toBe('Panel 1');
    expect(r.panels[1].suggested_name).toBe('Panel 2');
  });
});

describe('parsePatternText - errors', () => {
  it('warns on empty input', () => {
    const r = parsePatternText('');
    expect(r.panels).toEqual([]);
    expect(r.warnings[0]).toMatch(/[Ee]mpty/);
  });

  it('warns when no rows detected', () => {
    const r = parsePatternText('some free-form text with no row markers');
    expect(r.panels).toEqual([]);
    expect(r.warnings[0]).toMatch(/No row definitions/);
  });
});

describe('parsePatternText - normalization integration', () => {
  it('handles curly quotes in pasted text', () => {
    const r = parsePatternText('Row 1: K\u201Capple\u201D');
    expect(r.panels[0].rows[0].instruction).toBe('K"apple"');
  });
});
