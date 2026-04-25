/**
 * Section-based custom-shape draft for the Pattern Designer.
 *
 * The user picks "Custom shape" itemType and builds a stack of knitting
 * sections — each section says how many rows to work, what kind of work
 * (straight / ribbing / increase / decrease / cast off both edges /
 * bind off), and how many stitches change per side. The compute layer
 * walks the sections from the cast-on starting stitch count, threads
 * stitch counts through, and produces row-by-row instructions plus a
 * trapezoid-stack schematic.
 *
 * This is the parametric counterpart to the 7 preset itemTypes —
 * knitters who want a sleeve panel, modular square, machine-knit piece,
 * or any shape we don't enumerate can express it as a section sequence.
 */

export type DraftSectionType =
  | 'straight'
  | 'ribbing'
  | 'increase'
  | 'decrease'
  | 'cast_off_each_side'
  | 'bind_off';

/** Knitting style — changes the verbs in generated instructions
 *  ("knit" / "cast off" for machine, "work" / "bind off" for hand). */
export type CraftMode = 'hand' | 'machine';

export interface DraftSection {
  id: string;
  /** User-given name like "Ribbing" or "Armhole shaping". Free-form. */
  name: string;
  type: DraftSectionType;
  /** Number of rows worked in this section. */
  rows: number;
  /** Stitch change applied at each side per section (only used by
   *  increase / decrease / cast_off_each_side). Total change in stitch
   *  count is 2× this value; the section's compute logic mirrors the
   *  shaping across both edges. */
  changePerSide: number;
  /** Optional knitter note shown in the printable instructions. */
  note: string;
}

export interface CustomDraft {
  craftMode: CraftMode;
  /** Cast-on stitch count. Width derives from this × stitch gauge. */
  startingStitches: number;
  sections: DraftSection[];
}

export const DEFAULT_CUSTOM_DRAFT: CustomDraft = {
  craftMode: 'hand',
  startingStitches: 100,
  sections: [
    {
      id: 'default-ribbing',
      name: 'Ribbing',
      type: 'ribbing',
      rows: 12,
      changePerSide: 0,
      note: 'Work k1, p1 ribbing.',
    },
    {
      id: 'default-body',
      name: 'Body',
      type: 'straight',
      rows: 60,
      changePerSide: 0,
      note: '',
    },
    {
      id: 'default-shaping',
      name: 'Shaping',
      type: 'decrease',
      rows: 28,
      changePerSide: 8,
      note: 'Decrease evenly across the section.',
    },
  ],
};

export const SECTION_TYPE_LABELS: Record<DraftSectionType, string> = {
  straight: 'Straight',
  ribbing: 'Ribbing',
  increase: 'Increase',
  decrease: 'Decrease',
  cast_off_each_side: 'Cast off each side',
  bind_off: 'Bind off',
};
