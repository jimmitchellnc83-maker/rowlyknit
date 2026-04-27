import type { DesignCompute } from './designerSnapshot';

/**
 * Per-itemType finished-area formulas in square inches. Yardage estimates
 * across the Designer surface — the editor sidebar widget, the saved-design
 * card, and the publishing-copy print view — must agree, so the formulas
 * live here once and every consumer calls in.
 *
 * Each formula approximates the unfolded surface area of the finished
 * fabric. Sweater = 2 body panels + 2 sleeve trapezoids; hat = cylinder
 * minus a small taper allowance; shawl = triangle; etc. These are the
 * same approximations the print view used before this helper existed.
 *
 * Accepts a `Partial<DesignCompute>` so the print-view sections — which
 * compute body/sleeve/etc. individually rather than via `computeDesign` —
 * can pass `{ body, sleeve }` without manufacturing a fake `summary`.
 *
 * Returns null when the partial doesn't have enough data for any
 * itemType (sweater without sleeve, custom draft with zero height, etc.).
 */
export function finishedAreaSqIn(compute: Partial<DesignCompute>): number | null {
  if (compute.body && compute.sleeve) {
    const bodyArea = compute.body.finishedChest * compute.body.finishedLength;
    const sleeveArea =
      ((compute.sleeve.finishedCuff + compute.sleeve.finishedBicep) / 2) *
      compute.sleeve.finishedTotalLength;
    return 2 * bodyArea + 2 * sleeveArea;
  }
  if (compute.hat) {
    return compute.hat.finishedCircumference * compute.hat.finishedHeight * 0.9;
  }
  if (compute.scarf) {
    return compute.scarf.finishedWidth * compute.scarf.finishedLength;
  }
  if (compute.blanket) {
    return compute.blanket.finishedWidth * compute.blanket.finishedLength;
  }
  if (compute.shawl) {
    return compute.shawl.finishedWingspan * compute.shawl.finishedDepth * 0.5;
  }
  if (compute.mittens) {
    return (
      2 *
      (compute.mittens.finishedHandCircumference * compute.mittens.finishedLength +
        compute.mittens.finishedThumbCircumference * 2.5)
    );
  }
  if (compute.socks) {
    return (
      2 * compute.socks.finishedAnkleCircumference * compute.socks.finishedTotalLength
    );
  }
  if (compute.customDraft) {
    return (
      compute.customDraft.startingWidthInches *
      compute.customDraft.totalHeightInches *
      0.85
    );
  }
  return null;
}
