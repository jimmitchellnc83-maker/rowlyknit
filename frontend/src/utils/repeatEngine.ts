/**
 * Repeat expansion engine — PR 3 of the Designer rebuild.
 *
 * Walks a `SectionRowSequence` and produces a flat `ExpandedRow[]`
 * suitable for chart rendering, instruction text generation, and
 * make-mode row tracking. The engine is the single source of truth for
 * "what rows does this section actually produce?" — every consumer
 * downstream reads from the same expansion.
 *
 * Pure module — no I/O, no React, no DOM. Marker positions and
 * craft/technique come in as inputs; everything else is structural.
 *
 * Coverage: all seven PRD repeat forms.
 *  1. Horizontal (within-row)         — body unrolled inline
 *  2. Vertical (multi-row)            — body stacked N times
 *  3. Nested                          — outer wraps inner
 *  4. Mirrored (within-row + vertical) — body emitted forward then reversed
 *  5. Motif                           — 2D tiled (countH × countV)
 *  6. Between-markers                 — count derived from marker positions
 *  7. Panel                           — independent side-by-side panels
 */

import type {
  ExpandedPanelSlice,
  ExpandedRow,
  ExpandedToken,
  ExpansionResult,
  HorizontalRepeatToken,
  MarkerPositions,
  MirroredRepeatBlock,
  MotifRepeatBlock,
  NestedRepeatBlock,
  PanelRepeatBlock,
  RepeatBlock,
  RowSpec,
  RowToken,
  SectionRowSequence,
  VerticalRepeatBlock,
} from '../types/repeat';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Expand a section's row sequence to a flat list of `ExpandedRow`s.
 * Each expanded row carries source attribution back to the structured
 * pattern model so consumers (chart renderer, instruction text, make
 * mode) can map between the structured form and the working sequence.
 */
export function expandSection(section: SectionRowSequence): ExpansionResult {
  const ctx: ExpansionContext = {
    rows: [],
    warnings: [],
    markersByRow: section.markersByRow ?? {},
    rowCounter: 0,
  };

  for (const item of section.items) {
    if (item.kind === 'literal') {
      emitLiteralRow(ctx, item.row);
      continue;
    }
    expandBlock(ctx, item.block, /* iteration override */ null);
  }

  return { rows: ctx.rows, warnings: ctx.warnings };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface ExpansionContext {
  rows: ExpandedRow[];
  warnings: string[];
  markersByRow: Record<string, MarkerPositions>;
  rowCounter: number;
}

const nextRowNumber = (ctx: ExpansionContext): number => {
  ctx.rowCounter += 1;
  return ctx.rowCounter;
};

const emitLiteralRow = (ctx: ExpansionContext, row: RowSpec): void => {
  const markers = row.id ? ctx.markersByRow[row.id] : undefined;
  const { tokens, warnings } = expandRowTokens(row.tokens, markers, ctx);
  ctx.rows.push({
    rowNumber: nextRowNumber(ctx),
    tokens,
    label: row.label,
    source: {
      blockId: null,
      iteration: 1,
      positionInBody: 1,
      rowId: row.id ?? null,
    },
    warnings,
  });
};

const expandBlock = (
  ctx: ExpansionContext,
  block: RepeatBlock,
  outerIterationOverride: { iteration: number; blockId: string | null } | null,
): void => {
  switch (block.kind) {
    case 'vertical':
      return expandVertical(ctx, block, outerIterationOverride);
    case 'motif':
      return expandMotif(ctx, block);
    case 'mirrored':
      return expandMirrored(ctx, block);
    case 'nested':
      return expandNested(ctx, block);
    case 'panel':
      return expandPanel(ctx, block);
  }
};

const expandVertical = (
  ctx: ExpansionContext,
  block: VerticalRepeatBlock,
  outerIterationOverride: { iteration: number; blockId: string | null } | null,
): void => {
  if (block.count <= 0) {
    ctx.warnings.push(`Vertical repeat ${block.id ?? '(anon)'} count is ${block.count}; skipped.`);
    return;
  }
  if (block.body.length === 0) {
    ctx.warnings.push(`Vertical repeat ${block.id ?? '(anon)'} has empty body; skipped.`);
    return;
  }

  for (let iteration = 1; iteration <= block.count; iteration++) {
    block.body.forEach((row, idx) => {
      const markers = row.id ? ctx.markersByRow[row.id] : undefined;
      const { tokens, warnings } = expandRowTokens(row.tokens, markers, ctx);
      const source = outerIterationOverride
        ? {
            blockId: outerIterationOverride.blockId,
            iteration: outerIterationOverride.iteration,
            // Preserve the inner row position so consumers can still
            // identify which row of the inner body produced this output.
            positionInBody: idx + 1,
            rowId: row.id ?? null,
          }
        : {
            blockId: block.id ?? null,
            iteration,
            positionInBody: idx + 1,
            rowId: row.id ?? null,
          };
      ctx.rows.push({
        rowNumber: nextRowNumber(ctx),
        tokens,
        label: row.label,
        source,
        warnings,
      });
    });
  }
};

const expandMotif = (ctx: ExpansionContext, block: MotifRepeatBlock): void => {
  if (block.countVertical <= 0 || block.countHorizontal <= 0) {
    ctx.warnings.push(
      `Motif ${block.id ?? '(anon)'} has zero count (h=${block.countHorizontal}, v=${block.countVertical}); skipped.`,
    );
    return;
  }
  if (block.body.length === 0) {
    ctx.warnings.push(`Motif ${block.id ?? '(anon)'} has empty body; skipped.`);
    return;
  }

  for (let v = 1; v <= block.countVertical; v++) {
    block.body.forEach((row, idx) => {
      const markers = row.id ? ctx.markersByRow[row.id] : undefined;
      // Each row of the motif emits its tokens countHorizontal times to
      // tile across. We treat this as wrapping the row's tokens in a
      // virtual horizontal repeat keyed to the motif's id.
      const tiledTokens: RowToken[] = [
        {
          kind: 'horizontal-repeat',
          id: block.id,
          label: block.label,
          body: row.tokens,
          count: block.countHorizontal,
        },
      ];
      const { tokens, warnings } = expandRowTokens(tiledTokens, markers, ctx);
      ctx.rows.push({
        rowNumber: nextRowNumber(ctx),
        tokens,
        label: row.label,
        source: {
          blockId: block.id ?? null,
          iteration: v,
          positionInBody: idx + 1,
          rowId: row.id ?? null,
        },
        warnings,
      });
    });
  }
};

const expandMirrored = (ctx: ExpansionContext, block: MirroredRepeatBlock): void => {
  if (block.body.length === 0) {
    ctx.warnings.push(`Mirrored block ${block.id ?? '(anon)'} has empty body; skipped.`);
    return;
  }
  // Forward pass.
  block.body.forEach((row, idx) => {
    emitMirroredRow(ctx, block, row, idx + 1, 'forward');
  });
  // Reverse pass — same rows in reverse order. PR 3 implements
  // structural mirror only; symbol-level mirroring (k2tog ↔ ssk) needs
  // a per-symbol mirror table that doesn't exist yet.
  const reversed = [...block.body].reverse();
  reversed.forEach((row, idx) => {
    emitMirroredRow(ctx, block, row, block.body.length + idx + 1, 'mirror');
  });
};

const emitMirroredRow = (
  ctx: ExpansionContext,
  block: MirroredRepeatBlock,
  row: RowSpec,
  positionInBody: number,
  pass: 'forward' | 'mirror',
): void => {
  const markers = row.id ? ctx.markersByRow[row.id] : undefined;
  // Mirror pass reverses the within-row token order so the row reads
  // backward.
  const tokens =
    pass === 'mirror' ? [...row.tokens].reverse() : row.tokens;
  const { tokens: expanded, warnings } = expandRowTokens(tokens, markers, ctx);
  ctx.rows.push({
    rowNumber: nextRowNumber(ctx),
    tokens: expanded,
    label: row.label ? `${row.label}${pass === 'mirror' ? ' (mirror)' : ''}` : undefined,
    source: {
      blockId: block.id ?? null,
      iteration: pass === 'forward' ? 1 : 2,
      positionInBody,
      rowId: row.id ?? null,
    },
    warnings,
  });
};

const expandNested = (ctx: ExpansionContext, block: NestedRepeatBlock): void => {
  if (block.outerCount <= 0) {
    ctx.warnings.push(`Nested block ${block.id ?? '(anon)'} outerCount is ${block.outerCount}; skipped.`);
    return;
  }

  for (let outer = 1; outer <= block.outerCount; outer++) {
    if (block.inner.kind === 'vertical') {
      // Optimization: when the inner is vertical, we can reuse the
      // inner's expansion logic but tag the iteration with the OUTER
      // count so the source attribution reflects the nesting structure.
      const synthetic: VerticalRepeatBlock = {
        ...block.inner,
        id: block.inner.id ?? block.id,
      };
      expandVertical(ctx, synthetic, {
        iteration: outer,
        blockId: block.id ?? null,
      });
    } else {
      // For non-vertical inners, just delegate per outer iteration.
      // Source attribution still tracks back to the inner block id.
      expandBlock(ctx, block.inner, null);
    }
  }
};

const expandPanel = (ctx: ExpansionContext, block: PanelRepeatBlock): void => {
  if (block.panels.length === 0) {
    ctx.warnings.push(`Panel block ${block.id ?? '(anon)'} has no panels; skipped.`);
    return;
  }
  for (const panel of block.panels) {
    if (panel.body.length === 0) {
      ctx.warnings.push(`Panel ${panel.id} in block ${block.id ?? '(anon)'} has empty body.`);
    }
  }

  // Default row count = LCM of panel body lengths so all panels realign
  // at the end. The user can override with `block.rows`.
  const bodyLengths = block.panels.map((p) => Math.max(1, p.body.length));
  const totalRows = block.rows ?? bodyLengths.reduce(lcm, 1);

  for (let i = 0; i < totalRows; i++) {
    const slices: ExpandedPanelSlice[] = [];
    const rowWarnings: string[] = [];
    const combinedTokens: ExpandedToken[] = [];

    for (const panel of block.panels) {
      const len = panel.body.length;
      if (len === 0) {
        slices.push({
          panelId: panel.id,
          width: panel.width,
          tokens: [],
          iteration: 1,
          positionInBody: 1,
        });
        continue;
      }
      const positionInBody = (i % len) + 1;
      const iteration = Math.floor(i / len) + 1;
      const row = panel.body[i % len];
      const markers = row.id ? ctx.markersByRow[row.id] : undefined;
      const { tokens, warnings } = expandRowTokens(row.tokens, markers, ctx);
      slices.push({
        panelId: panel.id,
        width: panel.width,
        tokens,
        iteration,
        positionInBody,
      });
      combinedTokens.push(...tokens);
      rowWarnings.push(...warnings);
    }

    ctx.rows.push({
      rowNumber: nextRowNumber(ctx),
      tokens: combinedTokens,
      label: block.label,
      source: {
        blockId: block.id ?? null,
        iteration: 1,
        positionInBody: i + 1,
        rowId: null,
      },
      panelSlices: slices,
      warnings: rowWarnings,
    });
  }
};

// ---------------------------------------------------------------------------
// Within-row token expansion
// ---------------------------------------------------------------------------

interface RowExpansionOutput {
  tokens: ExpandedToken[];
  warnings: string[];
}

const expandRowTokens = (
  tokens: RowToken[],
  markers: MarkerPositions | undefined,
  ctx: ExpansionContext,
): RowExpansionOutput => {
  const out: ExpandedToken[] = [];
  const warnings: string[] = [];
  for (const token of tokens) {
    expandRowToken(token, markers, out, warnings, /* parentBlockId */ null, /* parentIteration */ 1);
  }
  // Surface row-level warnings to the section warnings as well so they
  // show up in the top-level result.
  ctx.warnings.push(...warnings);
  return { tokens: out, warnings };
};

const expandRowToken = (
  token: RowToken,
  markers: MarkerPositions | undefined,
  out: ExpandedToken[],
  warnings: string[],
  parentBlockId: string | null,
  parentIteration: number,
): void => {
  switch (token.kind) {
    case 'stitch':
      out.push({
        kind: 'stitch',
        symbolId: token.symbolId,
        cellSpan: token.cellSpan ?? 1,
        note: token.note,
        source: parentBlockId
          ? { blockId: parentBlockId, iteration: parentIteration }
          : null,
      });
      return;

    case 'horizontal-repeat':
      expandHorizontalRepeat(token, markers, out, warnings);
      return;

    case 'between-markers':
      expandBetweenMarkers(token, markers, out, warnings);
      return;

    case 'mirrored': {
      // Forward pass.
      for (const inner of token.body) {
        expandRowToken(inner, markers, out, warnings, token.id ?? parentBlockId, 1);
      }
      // Mirror pass.
      const reversed = [...token.body].reverse();
      for (const inner of reversed) {
        expandRowToken(inner, markers, out, warnings, token.id ?? parentBlockId, 2);
      }
      return;
    }
  }
};

const expandHorizontalRepeat = (
  token: HorizontalRepeatToken,
  markers: MarkerPositions | undefined,
  out: ExpandedToken[],
  warnings: string[],
): void => {
  if (token.count <= 0) {
    warnings.push(`Horizontal repeat ${token.id ?? '(anon)'} count is ${token.count}; skipped.`);
    return;
  }
  if (token.body.length === 0) {
    warnings.push(`Horizontal repeat ${token.id ?? '(anon)'} has empty body; skipped.`);
    return;
  }

  for (let i = 1; i <= token.count; i++) {
    for (const inner of token.body) {
      expandRowToken(inner, markers, out, warnings, token.id ?? null, i);
    }
  }
};

const expandBetweenMarkers = (
  token: import('../types/repeat').BetweenMarkersToken,
  markers: MarkerPositions | undefined,
  out: ExpandedToken[],
  warnings: string[],
): void => {
  if (!markers) {
    warnings.push(
      `Between-markers ${token.id ?? '(anon)'} (${token.fromMarker}→${token.toMarker}): no marker map for this row; skipped.`,
    );
    return;
  }
  const fromPos = markers[token.fromMarker];
  const toPos = markers[token.toMarker];
  if (fromPos === undefined || toPos === undefined) {
    warnings.push(
      `Between-markers ${token.id ?? '(anon)'}: marker(s) not found (${token.fromMarker}, ${token.toMarker}); skipped.`,
    );
    return;
  }
  const span = Math.max(0, toPos - fromPos);
  const bodyWidth = bodyStitchWidth(token.body);
  if (bodyWidth === 0) {
    warnings.push(
      `Between-markers ${token.id ?? '(anon)'}: body width is 0; skipped.`,
    );
    return;
  }
  const count = Math.floor(span / bodyWidth);
  if (count === 0) {
    warnings.push(
      `Between-markers ${token.id ?? '(anon)'}: marker span (${span}) smaller than body width (${bodyWidth}); 0 iterations.`,
    );
    return;
  }

  for (let i = 1; i <= count; i++) {
    for (const inner of token.body) {
      expandRowToken(inner, markers, out, warnings, token.id ?? null, i);
    }
  }
};

/** Sum of cell spans for the literal stitches in a token body. Returns
 *  0 when the body has no literal stitches (only nested repeats), since
 *  there is no canonical width for that case. */
const bodyStitchWidth = (body: RowToken[]): number => {
  let w = 0;
  for (const t of body) {
    if (t.kind === 'stitch') w += t.cellSpan ?? 1;
  }
  return w;
};

// ---------------------------------------------------------------------------
// LCM / GCD for panel row alignment
// ---------------------------------------------------------------------------

const gcd = (a: number, b: number): number => {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
};

const lcm = (a: number, b: number): number => {
  if (a === 0 || b === 0) return 0;
  return Math.abs(a * b) / gcd(a, b);
};
