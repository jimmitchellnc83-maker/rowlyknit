/**
 * Complete Knitting Stitch Symbol Library
 * Based on Craft Yarn Council Standards + comprehensive knitting resources
 */

export interface SymbolData {
  id: string;
  symbol: string;
  name: string;
  abbr: string;
  description: string;
  fallback?: string;
  width?: number; // For multi-stitch symbols like cables
  category?: string;
  categoryKey?: string;
}

export interface CategoryData {
  name: string;
  description?: string;
  symbols: SymbolData[];
}

export interface SymbolLibrary {
  [key: string]: CategoryData;
}

export const KNITTING_SYMBOLS: SymbolLibrary = {
  // BASIC STITCHES
  basic: {
    name: "Basic Stitches",
    symbols: [
      { id: "k", symbol: "□", name: "Knit", abbr: "k", description: "Knit stitch" },
      { id: "p", symbol: "—", name: "Purl", abbr: "p", description: "Purl stitch" },
      { id: "yo", symbol: "○", name: "Yarn Over", abbr: "yo", description: "Yarn over" },
      { id: "sl", symbol: "v", name: "Slip", abbr: "sl", description: "Slip stitch" },
      { id: "no-stitch", symbol: "◊", name: "No Stitch", abbr: "", description: "No stitch (placeholder)" },
      { id: "k-tbl", symbol: "⊠", name: "Knit TBL", abbr: "k tbl", description: "Knit through back loop" },
      { id: "p-tbl", symbol: "⊞", name: "Purl TBL", abbr: "p tbl", description: "Purl through back loop" },
      { id: "wrap", symbol: "◐", name: "Wrap", abbr: "w&t", description: "Wrap and turn" },
    ]
  },

  // DECREASES
  decreases: {
    name: "Decreases",
    symbols: [
      { id: "k2tog", symbol: "╲", name: "K2tog", abbr: "k2tog", description: "Knit 2 together (right lean)" },
      { id: "ssk", symbol: "╱", name: "SSK", abbr: "ssk", description: "Slip, slip, knit (left lean)" },
      { id: "p2tog", symbol: "⟩", name: "P2tog", abbr: "p2tog", description: "Purl 2 together" },
      { id: "ssp", symbol: "⟨", name: "SSP", abbr: "ssp", description: "Slip, slip, purl" },
      { id: "k3tog", symbol: "▽", name: "K3tog", abbr: "k3tog", description: "Knit 3 together" },
      { id: "sssk", symbol: "△", name: "SSSK", abbr: "sssk", description: "Slip, slip, slip, knit" },
      { id: "p3tog", symbol: "▼", name: "P3tog", abbr: "p3tog", description: "Purl 3 together" },
      { id: "cdd", symbol: "⌃", name: "CDD", abbr: "cdd", description: "Central double decrease" },
      { id: "sk2p", symbol: "^", name: "SK2P", abbr: "sk2p", description: "Slip, k2tog, pass slipped st over" },
    ]
  },

  // INCREASES
  increases: {
    name: "Increases",
    symbols: [
      { id: "kfb", symbol: "∨", name: "KFB", abbr: "kfb", description: "Knit front and back" },
      { id: "pfb", symbol: "∧", name: "PFB", abbr: "pfb", description: "Purl front and back" },
      { id: "m1", symbol: "◁", name: "M1", abbr: "m1", description: "Make 1" },
      { id: "m1l", symbol: "◀", name: "M1L", abbr: "m1l", description: "Make 1 left" },
      { id: "m1r", symbol: "▶", name: "M1R", abbr: "m1r", description: "Make 1 right" },
      { id: "m1p", symbol: "▽", name: "M1P", abbr: "m1p", description: "Make 1 purl" },
      { id: "kll", symbol: "◄", name: "KLL", abbr: "kll", description: "Knit left lifted increase" },
      { id: "krl", symbol: "►", name: "KRL", abbr: "krl", description: "Knit right lifted increase" },
      { id: "yo-twice", symbol: "◎", name: "YO Twice", abbr: "yo x2", description: "Yarn over twice" },
    ]
  },

  // CABLES - 2 STITCH
  cables2: {
    name: "2-Stitch Cables",
    symbols: [
      { id: "1-1-rc", symbol: "⋈", name: "1/1 RC", abbr: "1/1 rc", description: "1 over 1 right cable", width: 2 },
      { id: "1-1-lc", symbol: "⋉", name: "1/1 LC", abbr: "1/1 lc", description: "1 over 1 left cable", width: 2 },
      { id: "1-1-rpc", symbol: "⋊", name: "1/1 RPC", abbr: "1/1 rpc", description: "1 over 1 right purl cable", width: 2 },
      { id: "1-1-lpc", symbol: "⋋", name: "1/1 LPC", abbr: "1/1 lpc", description: "1 over 1 left purl cable", width: 2 },
    ]
  },

  // CABLES - 3 STITCH
  cables3: {
    name: "3-Stitch Cables",
    symbols: [
      { id: "2-1-rc", symbol: "⊳", name: "2/1 RC", abbr: "2/1 rc", description: "2 over 1 right cable", width: 3 },
      { id: "2-1-lc", symbol: "⊲", name: "2/1 LC", abbr: "2/1 lc", description: "2 over 1 left cable", width: 3 },
      { id: "2-1-rpc", symbol: "▷", name: "2/1 RPC", abbr: "2/1 rpc", description: "2 over 1 right purl cable", width: 3 },
      { id: "2-1-lpc", symbol: "◁", name: "2/1 LPC", abbr: "2/1 lpc", description: "2 over 1 left purl cable", width: 3 },
    ]
  },

  // CABLES - 4 STITCH
  cables4: {
    name: "4-Stitch Cables",
    symbols: [
      { id: "2-2-rc", symbol: "▸", name: "2/2 RC", abbr: "2/2 rc", description: "2 over 2 right cable", width: 4 },
      { id: "2-2-lc", symbol: "◂", name: "2/2 LC", abbr: "2/2 lc", description: "2 over 2 left cable", width: 4 },
      { id: "2-2-rpc", symbol: "▹", name: "2/2 RPC", abbr: "2/2 rpc", description: "2 over 2 right purl cable", width: 4 },
      { id: "2-2-lpc", symbol: "◃", name: "2/2 LPC", abbr: "2/2 lpc", description: "2 over 2 left purl cable", width: 4 },
      { id: "c4f", symbol: "⊕", name: "C4F", abbr: "c4f", description: "Cable 4 front", width: 4 },
      { id: "c4b", symbol: "⊗", name: "C4B", abbr: "c4b", description: "Cable 4 back", width: 4 },
    ]
  },

  // CABLES - 6 STITCH
  cables6: {
    name: "6-Stitch Cables",
    symbols: [
      { id: "3-3-rc", symbol: "⋗", name: "3/3 RC", abbr: "3/3 rc", description: "3 over 3 right cable", width: 6 },
      { id: "3-3-lc", symbol: "⋖", name: "3/3 LC", abbr: "3/3 lc", description: "3 over 3 left cable", width: 6 },
      { id: "c6f", symbol: "⊛", name: "C6F", abbr: "c6f", description: "Cable 6 front", width: 6 },
      { id: "c6b", symbol: "⊚", name: "C6B", abbr: "c6b", description: "Cable 6 back", width: 6 },
    ]
  },

  // LACE & EYELETS
  lace: {
    name: "Lace & Eyelets",
    symbols: [
      { id: "lace-yo", symbol: "○", name: "Yarn Over", abbr: "yo", description: "Yarn over" },
      { id: "lace-yo-twice", symbol: "◎", name: "Double YO", abbr: "yo x2", description: "Yarn over twice" },
      { id: "nupps", symbol: "⊙", name: "Nupps", abbr: "nupps", description: "Nupps (bobble)" },
      { id: "k-yo-3", symbol: "⊕", name: "K YO 3x", abbr: "k yo x3", description: "Knit wrapping yarn 3 times" },
    ]
  },

  // BOBBLES & SPECIAL
  special: {
    name: "Bobbles & Special",
    symbols: [
      { id: "bobble", symbol: "●", name: "Bobble", abbr: "bobble", description: "Make bobble (5 from 1)" },
      { id: "mb5", symbol: "⬤", name: "MB5", abbr: "mb5", description: "Make 5-stitch bobble" },
      { id: "cluster", symbol: "◉", name: "Cluster", abbr: "cluster", description: "Cluster stitch" },
      { id: "puff", symbol: "◘", name: "Puff", abbr: "puff", description: "Puff stitch" },
      { id: "popcorn", symbol: "◙", name: "Popcorn", abbr: "popcorn", description: "Popcorn stitch" },
    ]
  },

  // BIND OFF & CAST ON
  edging: {
    name: "Cast On & Bind Off",
    symbols: [
      { id: "co", symbol: "⌐", name: "Cast On", abbr: "co", description: "Cast on stitch" },
      { id: "bo", symbol: "⌙", name: "Bind Off", abbr: "bo", description: "Bind off stitch" },
      { id: "bo-rem", symbol: "┐", name: "BO Rem", abbr: "bo rem", description: "Stitch remaining after bind off" },
    ]
  },

  // COLOR WORK
  colorwork: {
    name: "Colorwork",
    symbols: [
      { id: "mc", symbol: "■", name: "Main Color", abbr: "mc", description: "Main color stitch" },
      { id: "cc1", symbol: "▪", name: "CC1", abbr: "cc1", description: "Contrast color 1" },
      { id: "cc2", symbol: "▫", name: "CC2", abbr: "cc2", description: "Contrast color 2" },
      { id: "cc3", symbol: "□", name: "CC3", abbr: "cc3", description: "Contrast color 3" },
    ]
  },

  // SHORT ROWS
  shortRows: {
    name: "Short Rows",
    symbols: [
      { id: "wt", symbol: "◐", name: "W&T", abbr: "w&t", description: "Wrap and turn" },
      { id: "pickup-wrap", symbol: "◑", name: "Pickup Wrap", abbr: "pickup", description: "Pick up wrap" },
    ]
  },

  // BRIOCHE
  brioche: {
    name: "Brioche",
    symbols: [
      { id: "brk", symbol: "⊡", name: "BRK", abbr: "brk", description: "Brioche knit" },
      { id: "brp", symbol: "⊟", name: "BRP", abbr: "brp", description: "Brioche purl" },
      { id: "sl-yo", symbol: "◊", name: "Sl+YO", abbr: "sl yo", description: "Slip with yarn over" },
    ]
  }
};

// Helper function to get all symbols as flat array
export const getAllSymbols = (): SymbolData[] => {
  const allSymbols: SymbolData[] = [];
  Object.keys(KNITTING_SYMBOLS).forEach(categoryKey => {
    const category = KNITTING_SYMBOLS[categoryKey];
    category.symbols.forEach(symbol => {
      allSymbols.push({
        ...symbol,
        category: category.name,
        categoryKey
      });
    });
  });
  return allSymbols;
};

// Helper function to search symbols
export const searchSymbols = (query: string): SymbolData[] => {
  const allSymbols = getAllSymbols();
  const lowerQuery = query.toLowerCase();
  return allSymbols.filter(symbol =>
    symbol.name.toLowerCase().includes(lowerQuery) ||
    symbol.abbr.toLowerCase().includes(lowerQuery) ||
    symbol.description.toLowerCase().includes(lowerQuery)
  );
};

// Get categories for tabs
export const getCategories = (): { key: string; name: string; count: number; description?: string }[] => {
  return Object.keys(KNITTING_SYMBOLS).map(key => ({
    key,
    name: KNITTING_SYMBOLS[key].name,
    count: KNITTING_SYMBOLS[key].symbols.length,
    description: KNITTING_SYMBOLS[key].description
  }));
};

// Export total count
export const SYMBOL_COUNT = getAllSymbols().length;
export const TOTAL_SYMBOL_COUNT = SYMBOL_COUNT;

// Default symbol (knit stitch)
export const DEFAULT_SYMBOL: SymbolData = KNITTING_SYMBOLS.basic.symbols[0];
