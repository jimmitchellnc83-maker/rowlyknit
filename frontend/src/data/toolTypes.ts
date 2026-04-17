export interface ToolType {
  value: string;
  label: string;
}

export interface ToolCategory {
  value: string;
  label: string;
  color: string; // Tailwind badge classes: bg + text
  types: ToolType[];
}

export const TOOL_CATEGORIES: ToolCategory[] = [
  {
    value: 'knitting_needles',
    label: 'Knitting Needles',
    color: 'bg-blue-100 text-blue-800',
    types: [
      { value: 'straight_needle', label: 'Straight Needles' },
      { value: 'circular_needle', label: 'Circular Needles' },
      { value: 'dpn', label: 'Double-Pointed Needles (DPN)' },
      { value: 'interchangeable_set', label: 'Interchangeable Set' },
      { value: 'flex_needle', label: 'Flex Needles' },
    ],
  },
  {
    value: 'crochet_hooks',
    label: 'Crochet Hooks',
    color: 'bg-purple-100 text-purple-800',
    types: [
      { value: 'standard_hook', label: 'Standard Hook' },
      { value: 'ergonomic_hook', label: 'Ergonomic Hook' },
      { value: 'tunisian_hook', label: 'Tunisian Hook' },
      { value: 'steel_hook', label: 'Steel Lace Hook' },
    ],
  },
  {
    value: 'measuring',
    label: 'Measuring & Sizing',
    color: 'bg-teal-100 text-teal-800',
    types: [
      { value: 'tape_measure', label: 'Tape Measure / Ruler' },
      { value: 'gauge_ruler', label: 'Gauge Ruler / Needle Sizer' },
      { value: 'row_counter', label: 'Row / Stitch Counter' },
    ],
  },
  {
    value: 'markers_holders',
    label: 'Markers & Holders',
    color: 'bg-amber-100 text-amber-800',
    types: [
      { value: 'stitch_marker', label: 'Stitch Markers' },
      { value: 'stitch_holder', label: 'Stitch Holder' },
      { value: 'cable_needle', label: 'Cable Needle' },
      { value: 'point_protector', label: 'Point Protector / Needle Stopper' },
    ],
  },
  {
    value: 'cutting_finishing',
    label: 'Cutting & Finishing',
    color: 'bg-red-100 text-red-800',
    types: [
      { value: 'scissors', label: 'Scissors / Snips' },
      { value: 'tapestry_needle', label: 'Tapestry / Yarn Needle' },
      { value: 'seaming_tool', label: 'Seaming / Assembly Tool' },
    ],
  },
  {
    value: 'blocking',
    label: 'Blocking & Shaping',
    color: 'bg-sky-100 text-sky-800',
    types: [
      { value: 'blocking_mat', label: 'Blocking Mat' },
      { value: 'blocking_pins', label: 'Blocking Pins / T-Pins' },
      { value: 'blocking_wire', label: 'Blocking Wires / Combs' },
      { value: 'spray_bottle', label: 'Spray Bottle / Steamer' },
    ],
  },
  {
    value: 'yarn_handling',
    label: 'Yarn Handling & Storage',
    color: 'bg-emerald-100 text-emerald-800',
    types: [
      { value: 'yarn_swift', label: 'Yarn Swift' },
      { value: 'ball_winder', label: 'Ball Winder' },
      { value: 'yarn_bowl', label: 'Yarn Bowl / Spinner' },
      { value: 'project_bag', label: 'Project Bag / Case' },
    ],
  },
  {
    value: 'comfort',
    label: 'Comfort & Ergonomics',
    color: 'bg-rose-100 text-rose-800',
    types: [
      { value: 'grip_cover', label: 'Grip / Handle Cover' },
      { value: 'craft_light', label: 'Craft Light' },
    ],
  },
  {
    value: 'specialty',
    label: 'Specialty Tools',
    color: 'bg-indigo-100 text-indigo-800',
    types: [
      { value: 'pompom_maker', label: 'Pom-Pom / Tassel Maker' },
      { value: 'sock_blocker', label: 'Sock Blocker' },
      { value: 'repair_hook', label: 'Repair / Fix-It Hook' },
      { value: 'combo_gauge', label: 'Combo Gauge Tool' },
    ],
  },
  {
    value: 'other',
    label: 'Other',
    color: 'bg-gray-100 text-gray-800',
    types: [
      { value: 'notebook', label: 'Notebook / Planner' },
      { value: 'notions_pouch', label: 'Notions Pouch / Organizer' },
      { value: 'other', label: 'Other' },
    ],
  },
];

// Lookup maps built once
const categoryMap = new Map(TOOL_CATEGORIES.map((c) => [c.value, c]));
const typeToCategory = new Map<string, ToolCategory>();
const typeMap = new Map<string, ToolType>();

for (const cat of TOOL_CATEGORIES) {
  for (const t of cat.types) {
    typeToCategory.set(t.value, cat);
    typeMap.set(t.value, t);
  }
}

export function getCategoryLabel(categoryValue: string): string {
  return categoryMap.get(categoryValue)?.label ?? categoryValue;
}

export function getCategoryColor(categoryValue: string): string {
  return categoryMap.get(categoryValue)?.color ?? 'bg-gray-100 text-gray-800';
}

export function getTypeLabel(typeValue: string): string {
  return typeMap.get(typeValue)?.label ?? typeValue;
}

export function getTypesForCategory(categoryValue: string): ToolType[] {
  return categoryMap.get(categoryValue)?.types ?? [];
}

export function getCategoryForType(typeValue: string): string {
  return typeToCategory.get(typeValue)?.value ?? 'other';
}
