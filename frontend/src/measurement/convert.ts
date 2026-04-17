// ── Numeric conversion functions ────────────────────────────────
// mm is the canonical length unit. Grams is canonical weight.
// Meters is canonical yarn length. Per-10cm is canonical gauge.
//
// Rounding: lengths to 1 decimal, gauge to 1 decimal,
// weight to 1 decimal, yarn length to 1 decimal.

const round1 = (v: number): number => Math.round(v * 10) / 10;
const round2 = (v: number): number => Math.round(v * 100) / 100;

// ── Length conversions (mm is canonical) ─────────────────────────

export function mmToCm(mm: number): number {
  return round1(mm / 10);
}

export function cmToMm(cm: number): number {
  return round1(cm * 10);
}

export function mmToIn(mm: number): number {
  return round2(mm / 25.4);
}

export function inToMm(inches: number): number {
  return round1(inches * 25.4);
}

export function mmToM(mm: number): number {
  return round1(mm / 1000);
}

export function mToMm(m: number): number {
  return round1(m * 1000);
}

export function mmToYd(mm: number): number {
  return round1(mm / 914.4);
}

export function ydToMm(yd: number): number {
  return round1(yd * 914.4);
}

export function inToCm(inches: number): number {
  return round1(inches * 2.54);
}

export function cmToIn(cm: number): number {
  return round1(cm / 2.54);
}

// ── Weight conversions (grams is canonical) ─────────────────────

export function gToOz(g: number): number {
  return round1(g * 0.03527396);
}

export function ozToG(oz: number): number {
  return round1(oz * 28.3495);
}

export function gToLb(g: number): number {
  return round2(g * 0.00220462);
}

export function lbToG(lb: number): number {
  return round1(lb * 453.592);
}

// ── Yarn length conversions (meters is canonical) ───────────────

export function mToYd(m: number): number {
  return round1(m * 1.09361);
}

export function ydToM(yd: number): number {
  return round1(yd * 0.9144);
}

// ── Gauge conversions (per-10cm is canonical storage) ───────────
// 4 inches = 10.16 cm

export function stitchesPer4InTo10Cm(per4in: number): number {
  return round1(per4in * (10 / 10.16));
}

export function stitchesPer10CmTo4In(per10cm: number): number {
  return round1(per10cm * (10.16 / 10));
}

export function rowsPer4InTo10Cm(per4in: number): number {
  return round1(per4in * (10 / 10.16));
}

export function rowsPer10CmTo4In(per10cm: number): number {
  return round1(per10cm * (10.16 / 10));
}

export function perCmToPer10Cm(perCm: number): number {
  return round1(perCm * 10);
}

export function perInToPer4In(perIn: number): number {
  return round1(perIn * 4);
}

// ── Approximate helpers ─────────────────────────────────────────

/** Wraps per inch to approximate yarn diameter in mm */
export function wpiToApproxMm(wpi: number): number {
  if (wpi <= 0) return 0;
  return round1(25.4 / wpi);
}

/** Yards per pound to meters per kilogram */
export function yppToMpkg(ypp: number): number {
  return round1(ypp * 2.016);
}

/** Meters per kilogram to yards per pound */
export function mpkgToYpp(mpkg: number): number {
  return round1(mpkg / 2.016);
}
