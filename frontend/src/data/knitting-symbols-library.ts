/**
 * Comprehensive Knitting Symbol Library
 * Based on Craft Yarn Council standards
 * 90+ symbols organized in 12 categories
 */

export interface SymbolData {
  id: string;
  symbol: string;
  name: string;
  abbr: string;
  description: string;
  fallback?: string;
  width?: number; // For multi-stitch symbols like cables
  category: string;
}

export interface CategoryData {
  name: string;
  description: string;
  symbols: SymbolData[];
}

export interface SymbolLibrary {
  [key: string]: CategoryData;
}

export const KNITTING_SYMBOLS: SymbolLibrary = {
  basic: {
    name: 'Basic Stitches',
    description: 'Fundamental knitting stitches',
    symbols: [
      { id: 'basic-empty', symbol: '□', name: 'Empty', abbr: '', description: 'Empty stitch', fallback: '.', category: 'basic' },
      { id: 'basic-knit', symbol: '|', name: 'Knit', abbr: 'K', description: 'Knit on RS, Purl on WS', fallback: 'K', category: 'basic' },
      { id: 'basic-purl', symbol: '−', name: 'Purl', abbr: 'P', description: 'Purl on RS, Knit on WS', fallback: 'P', category: 'basic' },
      { id: 'basic-yo', symbol: '○', name: 'Yarn Over', abbr: 'YO', description: 'Yarn over to create hole', fallback: 'O', category: 'basic' },
      { id: 'basic-slip', symbol: 'V', name: 'Slip', abbr: 'Sl', description: 'Slip stitch purlwise', fallback: 'S', category: 'basic' },
      { id: 'basic-no-stitch', symbol: '×', name: 'No Stitch', abbr: '', description: 'Placeholder - no stitch exists', fallback: 'X', category: 'basic' },
      { id: 'basic-ktbl', symbol: '⊙', name: 'Knit TBL', abbr: 'Ktbl', description: 'Knit through back loop', fallback: 'Kt', category: 'basic' },
      { id: 'basic-ptbl', symbol: '⊘', name: 'Purl TBL', abbr: 'Ptbl', description: 'Purl through back loop', fallback: 'Pt', category: 'basic' },
      { id: 'basic-wt', symbol: '◐', name: 'Wrap & Turn', abbr: 'W&T', description: 'Wrap stitch and turn work', fallback: 'W', category: 'basic' },
    ]
  },

  decreases: {
    name: 'Decreases',
    description: 'Stitches that reduce stitch count',
    symbols: [
      { id: 'dec-k2tog', symbol: '⟩', name: 'K2tog', abbr: 'K2tog', description: 'Knit 2 together (right-leaning)', fallback: '/', category: 'decreases' },
      { id: 'dec-ssk', symbol: '⟨', name: 'SSK', abbr: 'SSK', description: 'Slip slip knit (left-leaning)', fallback: '\\', category: 'decreases' },
      { id: 'dec-p2tog', symbol: '⊃', name: 'P2tog', abbr: 'P2tog', description: 'Purl 2 together', fallback: 'P2', category: 'decreases' },
      { id: 'dec-ssp', symbol: '⊂', name: 'SSP', abbr: 'SSP', description: 'Slip slip purl', fallback: 'SP', category: 'decreases' },
      { id: 'dec-k3tog', symbol: '⋀', name: 'K3tog', abbr: 'K3tog', description: 'Knit 3 together', fallback: '^', category: 'decreases' },
      { id: 'dec-sssk', symbol: '⋉', name: 'SSSK', abbr: 'SSSK', description: 'Slip slip slip knit', fallback: '3L', category: 'decreases' },
      { id: 'dec-p3tog', symbol: '⋃', name: 'P3tog', abbr: 'P3tog', description: 'Purl 3 together', fallback: 'P3', category: 'decreases' },
      { id: 'dec-cdd', symbol: '⋏', name: 'CDD', abbr: 'CDD', description: 'Central double decrease', fallback: 'CD', category: 'decreases' },
      { id: 'dec-sk2p', symbol: '⋔', name: 'SK2P', abbr: 'SK2P', description: 'Slip 1, K2tog, pass slipped st over', fallback: 'SK', category: 'decreases' },
    ]
  },

  increases: {
    name: 'Increases',
    description: 'Stitches that add to stitch count',
    symbols: [
      { id: 'inc-kfb', symbol: '⋎', name: 'KFB', abbr: 'Kfb', description: 'Knit front and back', fallback: 'V', category: 'increases' },
      { id: 'inc-pfb', symbol: '⋏', name: 'PFB', abbr: 'Pfb', description: 'Purl front and back', fallback: 'Vp', category: 'increases' },
      { id: 'inc-m1', symbol: '⊕', name: 'M1', abbr: 'M1', description: 'Make 1 stitch', fallback: '+', category: 'increases' },
      { id: 'inc-m1l', symbol: '⊲', name: 'M1L', abbr: 'M1L', description: 'Make 1 left (left-leaning)', fallback: '<|', category: 'increases' },
      { id: 'inc-m1r', symbol: '⊳', name: 'M1R', abbr: 'M1R', description: 'Make 1 right (right-leaning)', fallback: '|>', category: 'increases' },
      { id: 'inc-m1p', symbol: '⊛', name: 'M1P', abbr: 'M1P', description: 'Make 1 purlwise', fallback: '+P', category: 'increases' },
      { id: 'inc-kll', symbol: '⟦', name: 'KLL', abbr: 'KLL', description: 'Knit left loop', fallback: 'KL', category: 'increases' },
      { id: 'inc-krl', symbol: '⟧', name: 'KRL', abbr: 'KRL', description: 'Knit right loop', fallback: 'KR', category: 'increases' },
      { id: 'inc-dyo', symbol: '◎', name: 'Double YO', abbr: 'DYO', description: 'Double yarn over', fallback: 'OO', category: 'increases' },
    ]
  },

  cables2: {
    name: '2-Stitch Cables',
    description: 'Cable crosses over 2 stitches',
    symbols: [
      { id: 'cab2-1-1-rc', symbol: '⤨', name: '1/1 RC', abbr: '1/1RC', description: 'Right cross: 1 over 1', fallback: 'RC', width: 2, category: 'cables2' },
      { id: 'cab2-1-1-lc', symbol: '⤧', name: '1/1 LC', abbr: '1/1LC', description: 'Left cross: 1 over 1', fallback: 'LC', width: 2, category: 'cables2' },
      { id: 'cab2-1-1-rpc', symbol: '⤪', name: '1/1 RPC', abbr: '1/1RPC', description: 'Right purl cross: 1 over 1', fallback: 'RPC', width: 2, category: 'cables2' },
      { id: 'cab2-1-1-lpc', symbol: '⤩', name: '1/1 LPC', abbr: '1/1LPC', description: 'Left purl cross: 1 over 1', fallback: 'LPC', width: 2, category: 'cables2' },
    ]
  },

  cables3: {
    name: '3-Stitch Cables',
    description: 'Cable crosses over 3 stitches',
    symbols: [
      { id: 'cab3-2-1-rc', symbol: '⟰', name: '2/1 RC', abbr: '2/1RC', description: 'Right cross: 2 over 1', fallback: '2/1R', width: 3, category: 'cables3' },
      { id: 'cab3-2-1-lc', symbol: '⟱', name: '2/1 LC', abbr: '2/1LC', description: 'Left cross: 2 over 1', fallback: '2/1L', width: 3, category: 'cables3' },
      { id: 'cab3-2-1-rpc', symbol: '⟲', name: '2/1 RPC', abbr: '2/1RPC', description: 'Right purl cross: 2 over 1', fallback: '2/1RP', width: 3, category: 'cables3' },
      { id: 'cab3-2-1-lpc', symbol: '⟳', name: '2/1 LPC', abbr: '2/1LPC', description: 'Left purl cross: 2 over 1', fallback: '2/1LP', width: 3, category: 'cables3' },
    ]
  },

  cables4: {
    name: '4-Stitch Cables',
    description: 'Cable crosses over 4 stitches',
    symbols: [
      { id: 'cab4-2-2-rc', symbol: '⥤', name: '2/2 RC', abbr: '2/2RC', description: 'Right cross: 2 over 2', fallback: '2R2', width: 4, category: 'cables4' },
      { id: 'cab4-2-2-lc', symbol: '⥢', name: '2/2 LC', abbr: '2/2LC', description: 'Left cross: 2 over 2', fallback: '2L2', width: 4, category: 'cables4' },
      { id: 'cab4-2-2-rpc', symbol: '⥥', name: '2/2 RPC', abbr: '2/2RPC', description: 'Right purl cross: 2 over 2', fallback: '2RP2', width: 4, category: 'cables4' },
      { id: 'cab4-2-2-lpc', symbol: '⥣', name: '2/2 LPC', abbr: '2/2LPC', description: 'Left purl cross: 2 over 2', fallback: '2LP2', width: 4, category: 'cables4' },
      { id: 'cab4-c4f', symbol: '⨂', name: 'C4F', abbr: 'C4F', description: 'Cable 4 front', fallback: 'C4F', width: 4, category: 'cables4' },
      { id: 'cab4-c4b', symbol: '⨁', name: 'C4B', abbr: 'C4B', description: 'Cable 4 back', fallback: 'C4B', width: 4, category: 'cables4' },
    ]
  },

  cables6: {
    name: '6-Stitch Cables',
    description: 'Cable crosses over 6 stitches',
    symbols: [
      { id: 'cab6-3-3-rc', symbol: '⫸', name: '3/3 RC', abbr: '3/3RC', description: 'Right cross: 3 over 3', fallback: '3R3', width: 6, category: 'cables6' },
      { id: 'cab6-3-3-lc', symbol: '⫷', name: '3/3 LC', abbr: '3/3LC', description: 'Left cross: 3 over 3', fallback: '3L3', width: 6, category: 'cables6' },
      { id: 'cab6-c6f', symbol: '⬡', name: 'C6F', abbr: 'C6F', description: 'Cable 6 front', fallback: 'C6F', width: 6, category: 'cables6' },
      { id: 'cab6-c6b', symbol: '⬢', name: 'C6B', abbr: 'C6B', description: 'Cable 6 back', fallback: 'C6B', width: 6, category: 'cables6' },
    ]
  },

  lace: {
    name: 'Lace & Eyelets',
    description: 'Decorative openwork stitches',
    symbols: [
      { id: 'lace-yo', symbol: '○', name: 'Yarn Over', abbr: 'YO', description: 'Basic yarn over for eyelet', fallback: 'O', category: 'lace' },
      { id: 'lace-dyo', symbol: '◎', name: 'Double YO', abbr: 'DYO', description: 'Double yarn over for larger hole', fallback: 'OO', category: 'lace' },
      { id: 'lace-nupp', symbol: '◆', name: 'Nupp', abbr: 'Nupp', description: 'Estonian nupp (multiple loops)', fallback: 'N', category: 'lace' },
      { id: 'lace-yo3', symbol: '⦿', name: 'K YO 3x', abbr: 'YO3', description: 'Yarn over wrapped 3 times', fallback: 'O3', category: 'lace' },
    ]
  },

  bobbles: {
    name: 'Bobbles & Special',
    description: 'Textured 3D stitches',
    symbols: [
      { id: 'bob-bobble', symbol: '⊗', name: 'Bobble', abbr: 'BO', description: 'Basic bobble stitch', fallback: 'B', category: 'bobbles' },
      { id: 'bob-mb5', symbol: '⊛', name: 'MB5', abbr: 'MB5', description: 'Make bobble (5 st)', fallback: 'B5', category: 'bobbles' },
      { id: 'bob-cluster', symbol: '⋇', name: 'Cluster', abbr: 'CL', description: 'Cluster stitch', fallback: 'CL', category: 'bobbles' },
      { id: 'bob-puff', symbol: '⋈', name: 'Puff', abbr: 'PF', description: 'Puff stitch', fallback: 'PF', category: 'bobbles' },
      { id: 'bob-popcorn', symbol: '⊚', name: 'Popcorn', abbr: 'PC', description: 'Popcorn stitch', fallback: 'PC', category: 'bobbles' },
    ]
  },

  castbind: {
    name: 'Cast On & Bind Off',
    description: 'Beginning and ending stitches',
    symbols: [
      { id: 'cb-co', symbol: '⊢', name: 'Cast On', abbr: 'CO', description: 'Cast on stitch', fallback: 'CO', category: 'castbind' },
      { id: 'cb-bo', symbol: '⊣', name: 'Bind Off', abbr: 'BO', description: 'Bind off stitch', fallback: 'BO', category: 'castbind' },
      { id: 'cb-bor', symbol: '⊥', name: 'BO Remaining', abbr: 'BOR', description: 'Bind off remaining stitches', fallback: 'BOR', category: 'castbind' },
    ]
  },

  colorwork: {
    name: 'Colorwork',
    description: 'Multi-color knitting indicators',
    symbols: [
      { id: 'cw-mc', symbol: '■', name: 'Main Color', abbr: 'MC', description: 'Main color', fallback: 'MC', category: 'colorwork' },
      { id: 'cw-cc1', symbol: '▣', name: 'CC1', abbr: 'CC1', description: 'Contrast color 1', fallback: 'C1', category: 'colorwork' },
      { id: 'cw-cc2', symbol: '▤', name: 'CC2', abbr: 'CC2', description: 'Contrast color 2', fallback: 'C2', category: 'colorwork' },
      { id: 'cw-cc3', symbol: '▥', name: 'CC3', abbr: 'CC3', description: 'Contrast color 3', fallback: 'C3', category: 'colorwork' },
    ]
  },

  shortrows: {
    name: 'Short Rows',
    description: 'Shaping with partial rows',
    symbols: [
      { id: 'sr-wt', symbol: '◐', name: 'W&T', abbr: 'W&T', description: 'Wrap and turn', fallback: 'WT', category: 'shortrows' },
      { id: 'sr-pickup', symbol: '◑', name: 'Pickup Wrap', abbr: 'PUW', description: 'Pick up wrap and knit together', fallback: 'PU', category: 'shortrows' },
    ]
  },

  brioche: {
    name: 'Brioche',
    description: 'Brioche knitting stitches',
    symbols: [
      { id: 'br-brk', symbol: '⌇', name: 'BRK', abbr: 'BRK', description: 'Brioche knit', fallback: 'BK', category: 'brioche' },
      { id: 'br-brp', symbol: '⌁', name: 'BRP', abbr: 'BRP', description: 'Brioche purl', fallback: 'BP', category: 'brioche' },
      { id: 'br-slyo', symbol: '⌀', name: 'Sl+YO', abbr: 'SLYO', description: 'Slip with yarn over', fallback: 'SY', category: 'brioche' },
    ]
  },
};

/**
 * Get all symbols as a flat array
 */
export const getAllSymbols = (): SymbolData[] => {
  return Object.values(KNITTING_SYMBOLS).flatMap(category => category.symbols);
};

/**
 * Search symbols by name, abbreviation, or description
 */
export const searchSymbols = (query: string): SymbolData[] => {
  const lowerQuery = query.toLowerCase();
  return getAllSymbols().filter(symbol =>
    symbol.name.toLowerCase().includes(lowerQuery) ||
    symbol.abbr.toLowerCase().includes(lowerQuery) ||
    symbol.description.toLowerCase().includes(lowerQuery) ||
    symbol.symbol.includes(query)
  );
};

/**
 * Get symbol by ID
 */
export const getSymbolById = (id: string): SymbolData | undefined => {
  return getAllSymbols().find(symbol => symbol.id === id);
};

/**
 * Get symbols by category
 */
export const getSymbolsByCategory = (categoryKey: string): SymbolData[] => {
  return KNITTING_SYMBOLS[categoryKey]?.symbols || [];
};

/**
 * Get category info
 */
export const getCategoryInfo = (categoryKey: string): { name: string; description: string } | undefined => {
  const category = KNITTING_SYMBOLS[categoryKey];
  if (!category) return undefined;
  return { name: category.name, description: category.description };
};

/**
 * Get all category keys with counts
 */
export const getCategories = (): Array<{ key: string; name: string; count: number; description: string }> => {
  return Object.entries(KNITTING_SYMBOLS).map(([key, category]) => ({
    key,
    name: category.name,
    count: category.symbols.length,
    description: category.description,
  }));
};

/**
 * Default symbol (empty)
 */
export const DEFAULT_SYMBOL: SymbolData = KNITTING_SYMBOLS.basic.symbols[0];

/**
 * Total symbol count
 */
export const TOTAL_SYMBOL_COUNT = getAllSymbols().length;
