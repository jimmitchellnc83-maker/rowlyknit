import {
  computeLiveState,
  gcdOf,
  lcmOf,
  type PanelInput,
  type PanelRowInput,
} from '../panelMath';

describe('gcdOf / lcmOf', () => {
  it('gcd(12, 18) = 6', () => {
    expect(gcdOf(12, 18)).toBe(6);
  });

  it('gcd handles zero', () => {
    expect(gcdOf(0, 7)).toBe(7);
    expect(gcdOf(7, 0)).toBe(7);
  });

  it('lcm(4, 6) = 12', () => {
    expect(lcmOf(4, 6)).toBe(12);
  });

  it('lcm of the spec-described repeats (4, 10, 14, 26) = 1,820', () => {
    // Spec copy claims 26,180 for these repeats, but lcm(4, 10, 14, 26) = 1,820.
    // The spec's headline number needs to be reconciled — either with different
    // panel repeats or a different claim. This test pins the math.
    const lcm = [4, 10, 14, 26].reduce((a, b) => lcmOf(a, b), 1);
    expect(lcm).toBe(1820);
  });

  it('lcm(4, 10, 14, 26, 55) = 20,020 (example of 5-panel case)', () => {
    const lcm = [4, 10, 14, 26, 55].reduce((a, b) => lcmOf(a, b), 1);
    expect(lcm).toBe(20020);
  });
});

describe('computeLiveState', () => {
  const basePanels: PanelInput[] = [
    {
      id: 'cable-a',
      name: 'Cable A',
      repeat_length: 10,
      row_offset: 0,
      display_color: '#8B5CF6',
      sort_order: 0,
    },
    {
      id: 'seed',
      name: 'Seed Stitch',
      repeat_length: 4,
      row_offset: 0,
      display_color: null,
      sort_order: 1,
    },
  ];

  const baseRows: PanelRowInput[] = [
    { panel_id: 'cable-a', row_number: 1, instruction: 'K2, P2, C4F, P2, K2' },
    { panel_id: 'cable-a', row_number: 2, instruction: 'P2, K2, P4, K2, P2' },
    { panel_id: 'cable-a', row_number: 3, instruction: 'K2, P2, K4, P2, K2' },
    { panel_id: 'cable-a', row_number: 4, instruction: 'P2, K2, P4, K2, P2' },
    { panel_id: 'cable-a', row_number: 5, instruction: 'K2, P2, C4F, P2, K2' },
    { panel_id: 'cable-a', row_number: 6, instruction: 'P2, K2, P4, K2, P2' },
    { panel_id: 'cable-a', row_number: 7, instruction: 'K2, P2, K4, P2, K2' },
    { panel_id: 'cable-a', row_number: 8, instruction: 'P2, K2, P4, K2, P2' },
    { panel_id: 'cable-a', row_number: 9, instruction: 'K2, P2, K4, P2, K2' },
    { panel_id: 'cable-a', row_number: 10, instruction: 'P2, K2, P4, K2, P2' },
    { panel_id: 'seed', row_number: 1, instruction: '(K1, P1) to end' },
    { panel_id: 'seed', row_number: 2, instruction: '(P1, K1) to end' },
    { panel_id: 'seed', row_number: 3, instruction: '(K1, P1) to end' },
    { panel_id: 'seed', row_number: 4, instruction: '(P1, K1) to end' },
  ];

  it('at master row 1, both panels are on row 1', () => {
    const state = computeLiveState('m', 1, basePanels, baseRows);
    expect(state.master.current_row).toBe(1);
    expect(state.panels).toHaveLength(2);
    const [cable, seed] = state.panels;
    expect(cable.started).toBe(true);
    if (cable.started) {
      expect(cable.current_row).toBe(1);
      expect(cable.instruction).toBe('K2, P2, C4F, P2, K2');
    }
    expect(seed.started).toBe(true);
    if (seed.started) {
      expect(seed.current_row).toBe(1);
      expect(seed.instruction).toBe('(K1, P1) to end');
    }
  });

  it('at master row 47, Cable A is on row 7 and Seed on row 3', () => {
    const state = computeLiveState('m', 47, basePanels, baseRows);
    const [cable, seed] = state.panels;
    if (cable.started) {
      expect(cable.current_row).toBe(7); // (47-1) % 10 + 1 = 7
      expect(cable.rows_until_repeat).toBe(3);
    }
    if (seed.started) {
      expect(seed.current_row).toBe(3); // (47-1) % 4 + 1 = 3
      expect(seed.rows_until_repeat).toBe(1);
    }
  });

  it('row_offset delays a panel: offset 5 means masterRow < 6 → not started', () => {
    const offsetPanels: PanelInput[] = [
      { ...basePanels[0], row_offset: 5 },
    ];
    const offsetRows = baseRows.filter((r) => r.panel_id === 'cable-a');

    const beforeStart = computeLiveState('m', 3, offsetPanels, offsetRows);
    const panel = beforeStart.panels[0];
    expect(panel.started).toBe(false);
    if (!panel.started) {
      expect(panel.rows_until_start).toBe(3); // 5 - (3 - 1) = 3
    }

    const atStart = computeLiveState('m', 6, offsetPanels, offsetRows);
    const startedPanel = atStart.panels[0];
    expect(startedPanel.started).toBe(true);
    if (startedPanel.started) {
      expect(startedPanel.current_row).toBe(1); // effective row = 6-1-5 = 0 → row 1
    }
  });

  it('LCM math: rows_until_full_alignment returns lcm at the aligned row (not lcm-1)', () => {
    // This is the regression test for the spec's off-by-one formula.
    const state = computeLiveState('m', 1, basePanels, baseRows);
    expect(state.lcm).toBe(20); // lcm(10, 4) = 20
    expect(state.rows_until_full_alignment).toBe(20); // full cycle ahead
  });

  it('rows_until_full_alignment at masterRow=lcm is 1 (next row completes cycle)', () => {
    const state = computeLiveState('m', 20, basePanels, baseRows);
    expect(state.rows_until_full_alignment).toBe(1);
  });

  it('rows_until_full_alignment resets to lcm at masterRow=lcm+1', () => {
    const state = computeLiveState('m', 21, basePanels, baseRows);
    expect(state.rows_until_full_alignment).toBe(20);
  });

  it('missing panel_row returns empty instruction (not crash)', () => {
    const state = computeLiveState('m', 1, basePanels, []);
    const cable = state.panels[0];
    if (cable.started) {
      expect(cable.instruction).toBe('');
    }
  });

  it('single-panel group: LCM equals that panel repeat', () => {
    const state = computeLiveState('m', 1, [basePanels[0]], baseRows);
    expect(state.lcm).toBe(10);
    expect(state.rows_until_full_alignment).toBe(10);
  });

  it('panels are returned sorted by sort_order', () => {
    const shuffled: PanelInput[] = [
      { ...basePanels[1], sort_order: 1 },
      { ...basePanels[0], sort_order: 0 },
    ];
    const state = computeLiveState('m', 1, shuffled, baseRows);
    expect(state.panels[0].panel_id).toBe('cable-a');
    expect(state.panels[1].panel_id).toBe('seed');
  });

  it('4-panel case with repeats 4/10/14/26: LCM = 1,820', () => {
    const panels: PanelInput[] = [
      { id: 'a', name: 'A', repeat_length: 4, row_offset: 0, display_color: null, sort_order: 0 },
      { id: 'b', name: 'B', repeat_length: 10, row_offset: 0, display_color: null, sort_order: 1 },
      { id: 'c', name: 'C', repeat_length: 14, row_offset: 0, display_color: null, sort_order: 2 },
      { id: 'd', name: 'D', repeat_length: 26, row_offset: 0, display_color: null, sort_order: 3 },
    ];
    const state = computeLiveState('m', 1, panels, []);
    expect(state.lcm).toBe(1820);
    expect(state.rows_until_full_alignment).toBe(1820);
  });
});
