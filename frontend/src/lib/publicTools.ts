/**
 * Public-tool registry — Sprint 1 of the Public Tools Conversion engine.
 *
 * Every public-facing calculator / utility lives here so the rest of the
 * app (CalculatorsIndex grid, sitemap.xml builders, save-flow analytics,
 * "related tools" suggestions) reads from a single source of truth instead
 * of grep-and-pray. Adding a tool means adding an entry here AND the
 * actual page; both halves are wired by the registry.
 *
 * Structure mirrors the spec:
 *   - id            stable string for analytics + URL hash
 *   - route         canonical public route (no auth gate)
 *   - title         page <h1> + sitemap <title>
 *   - description   meta description
 *   - resultType    discriminator on the ToolResult.result shape
 *   - saveTargets   workspace destinations the result can attach to
 *   - related       sibling tools to surface in the "Related" rail
 *   - events        analytics names; keep stable across releases
 */

export type ToolId =
  | 'gauge'
  | 'size'
  | 'yardage'
  | 'row-repeat'
  | 'shaping';

export type SaveTarget = 'project' | 'pattern' | 'stash' | 'make-mode';

export type ResultType = ToolId;

export interface PublicTool {
  id: ToolId;
  route: string;
  title: string;
  description: string;
  resultType: ResultType;
  saveTargets: SaveTarget[];
  related: ToolId[];
  events: {
    viewed: string;
    used: string;
    resultGenerated: string;
  };
}

export const PUBLIC_TOOLS: Record<ToolId, PublicTool> = {
  gauge: {
    id: 'gauge',
    route: '/calculators/gauge',
    title: 'Gauge Calculator',
    description:
      'Compare your knit gauge to a pattern target and see exactly how much fabric will drift before you cast on.',
    resultType: 'gauge',
    saveTargets: ['project', 'pattern'],
    related: ['size', 'yardage'],
    events: {
      viewed: 'public_tool_viewed',
      used: 'public_tool_used',
      resultGenerated: 'public_tool_result_generated',
    },
  },
  size: {
    id: 'size',
    route: '/calculators/size',
    title: 'Gift Size Calculator',
    description:
      'Pick the right finished size from a chest measurement and a fit style — fitted, classic, relaxed, or oversized.',
    resultType: 'size',
    saveTargets: ['project', 'pattern'],
    related: ['gauge', 'yardage'],
    events: {
      viewed: 'public_tool_viewed',
      used: 'public_tool_used',
      resultGenerated: 'public_tool_result_generated',
    },
  },
  yardage: {
    id: 'yardage',
    route: '/calculators/yardage',
    title: 'Yardage & Skein Estimator',
    description:
      'Estimate how much yarn a project will eat — by garment type, size, and yarn weight — and how many skeins to buy.',
    resultType: 'yardage',
    saveTargets: ['project', 'stash'],
    related: ['gauge', 'size'],
    events: {
      viewed: 'public_tool_viewed',
      used: 'public_tool_used',
      resultGenerated: 'public_tool_result_generated',
    },
  },
  'row-repeat': {
    id: 'row-repeat',
    route: '/calculators/row-repeat',
    title: 'Row & Round Repeat Calculator',
    description:
      'Work out how many repeats fit between two markers, given total rows/rounds and the repeat length.',
    resultType: 'row-repeat',
    saveTargets: ['project', 'make-mode'],
    related: ['shaping', 'gauge'],
    events: {
      viewed: 'public_tool_viewed',
      used: 'public_tool_used',
      resultGenerated: 'public_tool_result_generated',
    },
  },
  shaping: {
    id: 'shaping',
    route: '/calculators/shaping',
    title: 'Increase / Decrease Spacing Calculator',
    description:
      'Spread shaping evenly: given start stitches, end stitches, and rows available, get the exact "every Nth row" plan.',
    resultType: 'shaping',
    saveTargets: ['project', 'make-mode'],
    related: ['row-repeat', 'size'],
    events: {
      viewed: 'public_tool_viewed',
      used: 'public_tool_used',
      resultGenerated: 'public_tool_result_generated',
    },
  },
};

export function getPublicTool(id: ToolId): PublicTool {
  return PUBLIC_TOOLS[id];
}

/**
 * Ordered list of all public tools — for sitemaps, index pages,
 * "related tools" exclusion logic, etc. The order is the order tools
 * appear on /calculators by default.
 */
export const PUBLIC_TOOL_LIST: PublicTool[] = [
  PUBLIC_TOOLS['gauge'],
  PUBLIC_TOOLS['size'],
  PUBLIC_TOOLS['yardage'],
  PUBLIC_TOOLS['row-repeat'],
  PUBLIC_TOOLS['shaping'],
];

export function getRelatedTools(id: ToolId): PublicTool[] {
  const tool = PUBLIC_TOOLS[id];
  return tool.related.map((rid) => PUBLIC_TOOLS[rid]);
}
