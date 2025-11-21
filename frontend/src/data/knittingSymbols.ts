// Comprehensive Knitting Chart Symbol Definitions
// Reference: Standard knitting chart symbols used in pattern charts

export interface KnittingSymbol {
  id: string;
  symbol: string;
  name: string;
  abbreviation: string;
  description: string;
  instructions: string;
  category: 'basic' | 'decrease' | 'increase' | 'cable' | 'twisted' | 'special' | 'colorwork';
  color?: string;
  rsInstruction?: string;  // Right side instruction
  wsInstruction?: string;  // Wrong side instruction
  videoUrl?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export const KNITTING_SYMBOLS: KnittingSymbol[] = [
  // Basic Stitches
  {
    id: 'knit',
    symbol: '□',
    name: 'Knit',
    abbreviation: 'K',
    description: 'Basic knit stitch - the foundation of all knitting',
    instructions: 'Insert needle from left to right through front of stitch, wrap yarn and pull through.',
    category: 'basic',
    color: '#FFFFFF',
    rsInstruction: 'Knit',
    wsInstruction: 'Purl',
    difficulty: 'beginner',
  },
  {
    id: 'purl',
    symbol: '•',
    name: 'Purl',
    abbreviation: 'P',
    description: 'Basic purl stitch - creates texture and reverse stockinette',
    instructions: 'Insert needle from right to left through front of stitch, wrap yarn and pull through.',
    category: 'basic',
    color: '#9CA3AF',
    rsInstruction: 'Purl',
    wsInstruction: 'Knit',
    difficulty: 'beginner',
  },
  {
    id: 'yarn_over',
    symbol: 'O',
    name: 'Yarn Over',
    abbreviation: 'YO',
    description: 'Creates an eyelet hole and adds one stitch',
    instructions: 'Wrap yarn around needle from front to back before knitting the next stitch.',
    category: 'increase',
    color: '#8B5CF6',
    rsInstruction: 'Yarn over',
    wsInstruction: 'Purl the yarn over',
    difficulty: 'beginner',
  },
  {
    id: 'slip_stitch',
    symbol: 'V',
    name: 'Slip Stitch',
    abbreviation: 'SL',
    description: 'Pass stitch from left to right needle without working it',
    instructions: 'Insert right needle into stitch as if to purl and slip it to the right needle.',
    category: 'basic',
    color: '#6B7280',
    rsInstruction: 'Slip 1 purlwise',
    wsInstruction: 'Slip 1 purlwise',
    difficulty: 'beginner',
  },

  // Decreases
  {
    id: 'k2tog',
    symbol: '/',
    name: 'Knit Two Together',
    abbreviation: 'K2tog',
    description: 'Right-leaning decrease that reduces stitch count by one',
    instructions: 'Insert needle through two stitches at once from left to right, knit them together.',
    category: 'decrease',
    color: '#EF4444',
    rsInstruction: 'Knit 2 stitches together',
    wsInstruction: 'Purl 2 stitches together',
    difficulty: 'beginner',
  },
  {
    id: 'ssk',
    symbol: '\\',
    name: 'Slip, Slip, Knit',
    abbreviation: 'SSK',
    description: 'Left-leaning decrease that reduces stitch count by one',
    instructions: 'Slip two stitches knitwise one at a time, insert left needle through front of both and knit together.',
    category: 'decrease',
    color: '#F59E0B',
    rsInstruction: 'Slip, slip, knit',
    wsInstruction: 'Slip, slip, purl through back loops',
    difficulty: 'intermediate',
  },
  {
    id: 'sk2p',
    symbol: '⟍',
    name: 'Slip, Knit 2 Together, Pass Slipped Stitch Over',
    abbreviation: 'SK2P',
    description: 'Centered double decrease that removes two stitches',
    instructions: 'Slip 1, knit 2 together, pass slipped stitch over the k2tog.',
    category: 'decrease',
    color: '#DC2626',
    rsInstruction: 'Slip 1, k2tog, psso',
    wsInstruction: 'Slip 1, p2tog tbl, psso',
    difficulty: 'intermediate',
  },
  {
    id: 's2kp',
    symbol: '⟋',
    name: 'Slip 2, Knit 1, Pass Slipped Stitches Over',
    abbreviation: 'S2KP',
    description: 'Centered double decrease (alternative method)',
    instructions: 'Slip 2 stitches together knitwise, knit 1, pass both slipped stitches over.',
    category: 'decrease',
    color: '#B91C1C',
    rsInstruction: 'Slip 2 tog, k1, psso',
    wsInstruction: 'P3tog tbl',
    difficulty: 'intermediate',
  },
  {
    id: 'k3tog',
    symbol: '⫽',
    name: 'Knit Three Together',
    abbreviation: 'K3tog',
    description: 'Right-leaning double decrease',
    instructions: 'Insert needle through three stitches at once and knit them together.',
    category: 'decrease',
    color: '#991B1B',
    rsInstruction: 'Knit 3 stitches together',
    wsInstruction: 'Purl 3 stitches together',
    difficulty: 'intermediate',
  },
  {
    id: 'sssk',
    symbol: '⫻',
    name: 'Slip, Slip, Slip, Knit',
    abbreviation: 'SSSK',
    description: 'Left-leaning double decrease',
    instructions: 'Slip three stitches knitwise one at a time, insert left needle and knit together.',
    category: 'decrease',
    color: '#78350F',
    rsInstruction: 'Slip, slip, slip, knit 3 together tbl',
    wsInstruction: 'Slip, slip, slip, purl 3 together tbl',
    difficulty: 'advanced',
  },

  // Increases
  {
    id: 'm1r',
    symbol: 'M',
    name: 'Make One Right',
    abbreviation: 'M1R',
    description: 'Right-leaning increase using the bar between stitches',
    instructions: 'Lift the bar between stitches from back to front with left needle, knit through front loop.',
    category: 'increase',
    color: '#10B981',
    rsInstruction: 'Make 1 right',
    wsInstruction: 'Make 1 right purlwise',
    difficulty: 'intermediate',
  },
  {
    id: 'm1l',
    symbol: 'Ṃ',
    name: 'Make One Left',
    abbreviation: 'M1L',
    description: 'Left-leaning increase using the bar between stitches',
    instructions: 'Lift the bar between stitches from front to back with left needle, knit through back loop.',
    category: 'increase',
    color: '#059669',
    rsInstruction: 'Make 1 left',
    wsInstruction: 'Make 1 left purlwise',
    difficulty: 'intermediate',
  },
  {
    id: 'kfb',
    symbol: '⩗',
    name: 'Knit Front and Back',
    abbreviation: 'KFB',
    description: 'Increase by knitting into front and back of same stitch',
    instructions: 'Knit into front of stitch, don\'t remove from needle, knit into back of same stitch.',
    category: 'increase',
    color: '#047857',
    rsInstruction: 'Knit front and back',
    wsInstruction: 'Purl front and back',
    difficulty: 'beginner',
  },
  {
    id: 'pfb',
    symbol: '⩔',
    name: 'Purl Front and Back',
    abbreviation: 'PFB',
    description: 'Increase by purling into front and back of same stitch',
    instructions: 'Purl into front of stitch, don\'t remove from needle, purl into back of same stitch.',
    category: 'increase',
    color: '#065F46',
    rsInstruction: 'Purl front and back',
    wsInstruction: 'Knit front and back',
    difficulty: 'beginner',
  },

  // Twisted Stitches
  {
    id: 'ktbl',
    symbol: '⟁',
    name: 'Knit Through Back Loop',
    abbreviation: 'KTBL',
    description: 'Creates a twisted stitch by knitting through back loop',
    instructions: 'Insert needle from right to left through back of stitch, wrap yarn and pull through.',
    category: 'twisted',
    color: '#6366F1',
    rsInstruction: 'Knit through back loop',
    wsInstruction: 'Purl through back loop',
    difficulty: 'intermediate',
  },
  {
    id: 'ptbl',
    symbol: '⟀',
    name: 'Purl Through Back Loop',
    abbreviation: 'PTBL',
    description: 'Creates a twisted purl stitch',
    instructions: 'Insert needle from left to right through back of stitch, wrap yarn and pull through.',
    category: 'twisted',
    color: '#4F46E5',
    rsInstruction: 'Purl through back loop',
    wsInstruction: 'Knit through back loop',
    difficulty: 'intermediate',
  },

  // Cables
  {
    id: 'c4f',
    symbol: '⟨⟩',
    name: 'Cable 4 Front',
    abbreviation: 'C4F',
    description: 'Cross 4 stitches with front stitches on top',
    instructions: 'Slip 2 stitches to cable needle, hold in front, knit 2, knit 2 from cable needle.',
    category: 'cable',
    color: '#EC4899',
    rsInstruction: 'Cable 4 front',
    wsInstruction: 'Work stitches as they appear',
    difficulty: 'intermediate',
  },
  {
    id: 'c4b',
    symbol: '⟩⟨',
    name: 'Cable 4 Back',
    abbreviation: 'C4B',
    description: 'Cross 4 stitches with back stitches on top',
    instructions: 'Slip 2 stitches to cable needle, hold in back, knit 2, knit 2 from cable needle.',
    category: 'cable',
    color: '#DB2777',
    rsInstruction: 'Cable 4 back',
    wsInstruction: 'Work stitches as they appear',
    difficulty: 'intermediate',
  },
  {
    id: 'c6f',
    symbol: '⟪⟫',
    name: 'Cable 6 Front',
    abbreviation: 'C6F',
    description: 'Cross 6 stitches with front stitches on top',
    instructions: 'Slip 3 stitches to cable needle, hold in front, knit 3, knit 3 from cable needle.',
    category: 'cable',
    color: '#BE185D',
    rsInstruction: 'Cable 6 front',
    wsInstruction: 'Work stitches as they appear',
    difficulty: 'advanced',
  },
  {
    id: 'c6b',
    symbol: '⟫⟪',
    name: 'Cable 6 Back',
    abbreviation: 'C6B',
    description: 'Cross 6 stitches with back stitches on top',
    instructions: 'Slip 3 stitches to cable needle, hold in back, knit 3, knit 3 from cable needle.',
    category: 'cable',
    color: '#9D174D',
    rsInstruction: 'Cable 6 back',
    wsInstruction: 'Work stitches as they appear',
    difficulty: 'advanced',
  },
  {
    id: 't3f',
    symbol: '⟨•',
    name: 'Twist 3 Front',
    abbreviation: 'T3F',
    description: 'Cross 3 stitches with front stitches including purl',
    instructions: 'Slip 2 stitches to cable needle, hold in front, purl 1, knit 2 from cable needle.',
    category: 'cable',
    color: '#F472B6',
    rsInstruction: 'Twist 3 front',
    wsInstruction: 'Work stitches as they appear',
    difficulty: 'advanced',
  },
  {
    id: 't3b',
    symbol: '•⟩',
    name: 'Twist 3 Back',
    abbreviation: 'T3B',
    description: 'Cross 3 stitches with back stitches including purl',
    instructions: 'Slip 1 stitch to cable needle, hold in back, knit 2, purl 1 from cable needle.',
    category: 'cable',
    color: '#F9A8D4',
    rsInstruction: 'Twist 3 back',
    wsInstruction: 'Work stitches as they appear',
    difficulty: 'advanced',
  },

  // Special Stitches
  {
    id: 'no_stitch',
    symbol: '▪',
    name: 'No Stitch',
    abbreviation: '-',
    description: 'Placeholder for non-existent stitch (shaping)',
    instructions: 'This is a placeholder - skip this cell when reading the chart.',
    category: 'special',
    color: '#D1D5DB',
    rsInstruction: 'No stitch',
    wsInstruction: 'No stitch',
    difficulty: 'beginner',
  },
  {
    id: 'bobble',
    symbol: '◯',
    name: 'Bobble',
    abbreviation: 'MB',
    description: 'Creates a raised bobble texture',
    instructions: 'Knit into front, back, front, back, front of stitch (5 sts), turn, purl 5, turn, knit 5, pass 4 sts over first.',
    category: 'special',
    color: '#A855F7',
    rsInstruction: 'Make bobble',
    wsInstruction: 'Work bobble from WS',
    difficulty: 'advanced',
  },
  {
    id: 'bead',
    symbol: '◈',
    name: 'Place Bead',
    abbreviation: 'PB',
    description: 'Place a bead on the stitch',
    instructions: 'Use crochet hook to place bead on stitch, then slip stitch purlwise.',
    category: 'special',
    color: '#14B8A6',
    rsInstruction: 'Place bead',
    wsInstruction: 'Slip beaded stitch purlwise',
    difficulty: 'advanced',
  },
  {
    id: 'wrap_turn',
    symbol: 'W',
    name: 'Wrap and Turn',
    abbreviation: 'W&T',
    description: 'Short row technique - wrap stitch and turn work',
    instructions: 'Slip next stitch, bring yarn to front/back, return stitch, turn work.',
    category: 'special',
    color: '#0EA5E9',
    rsInstruction: 'Wrap and turn',
    wsInstruction: 'Wrap and turn',
    difficulty: 'intermediate',
  },

  // Colorwork
  {
    id: 'mc',
    symbol: '□',
    name: 'Main Color',
    abbreviation: 'MC',
    description: 'Work with main color yarn',
    instructions: 'Work the stitch using your main color (MC) yarn.',
    category: 'colorwork',
    color: '#FFFFFF',
    rsInstruction: 'Knit with MC',
    wsInstruction: 'Purl with MC',
    difficulty: 'intermediate',
  },
  {
    id: 'cc1',
    symbol: '■',
    name: 'Contrast Color 1',
    abbreviation: 'CC1',
    description: 'Work with first contrast color',
    instructions: 'Work the stitch using your first contrast color (CC1) yarn.',
    category: 'colorwork',
    color: '#3B82F6',
    rsInstruction: 'Knit with CC1',
    wsInstruction: 'Purl with CC1',
    difficulty: 'intermediate',
  },
  {
    id: 'cc2',
    symbol: '▣',
    name: 'Contrast Color 2',
    abbreviation: 'CC2',
    description: 'Work with second contrast color',
    instructions: 'Work the stitch using your second contrast color (CC2) yarn.',
    category: 'colorwork',
    color: '#EF4444',
    rsInstruction: 'Knit with CC2',
    wsInstruction: 'Purl with CC2',
    difficulty: 'intermediate',
  },
  {
    id: 'cc3',
    symbol: '▤',
    name: 'Contrast Color 3',
    abbreviation: 'CC3',
    description: 'Work with third contrast color',
    instructions: 'Work the stitch using your third contrast color (CC3) yarn.',
    category: 'colorwork',
    color: '#10B981',
    rsInstruction: 'Knit with CC3',
    wsInstruction: 'Purl with CC3',
    difficulty: 'intermediate',
  },
];

// Helper function to get symbol by ID
export function getSymbolById(id: string): KnittingSymbol | undefined {
  return KNITTING_SYMBOLS.find(s => s.id === id);
}

// Helper function to get symbol by symbol character
export function getSymbolByChar(char: string): KnittingSymbol | undefined {
  return KNITTING_SYMBOLS.find(s => s.symbol === char);
}

// Helper function to get symbols by category
export function getSymbolsByCategory(category: KnittingSymbol['category']): KnittingSymbol[] {
  return KNITTING_SYMBOLS.filter(s => s.category === category);
}

// Helper function to search symbols
export function searchSymbols(query: string): KnittingSymbol[] {
  const lowerQuery = query.toLowerCase();
  return KNITTING_SYMBOLS.filter(s =>
    s.name.toLowerCase().includes(lowerQuery) ||
    s.abbreviation.toLowerCase().includes(lowerQuery) ||
    s.description.toLowerCase().includes(lowerQuery)
  );
}

// Category display names
export const SYMBOL_CATEGORIES: Record<KnittingSymbol['category'], string> = {
  basic: 'Basic Stitches',
  decrease: 'Decreases',
  increase: 'Increases',
  cable: 'Cables & Twists',
  twisted: 'Twisted Stitches',
  special: 'Special Stitches',
  colorwork: 'Colorwork',
};

export default KNITTING_SYMBOLS;
