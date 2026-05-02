/**
 * Browser-side perceptual dHash.
 *
 * Mirrors `backend/src/services/magicMarkerService.ts#computeDHash` so a
 * cell sampled in the browser hashes the same as a cell rendered server-
 * side. The pipeline is: source canvas region → resize to 9x8 grayscale
 * → row-pair difference → 64-bit hex string.
 *
 * Hamming distance lookup mirrors the backend too, so client-side
 * "preview match count" agrees with server-side scoring.
 */

const POPCOUNT4 = (n: number): number =>
  ((n >> 0) & 1) + ((n >> 1) & 1) + ((n >> 2) & 1) + ((n >> 3) & 1);

/**
 * Compute the 64-bit dHash of a region of a source canvas.
 *
 * @param source The source canvas to sample from. Most callers pass the
 *               PDF page canvas after react-pdf renders it.
 * @param x      Pixel x of the region's top-left.
 * @param y      Pixel y of the region's top-left.
 * @param w      Pixel width of the region.
 * @param h      Pixel height of the region.
 * @returns      16-char hex string (64 bits).
 */
export function dHashRegion(
  source: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
): string {
  const target = document.createElement('canvas');
  target.width = 9;
  target.height = 8;
  const ctx = target.getContext('2d');
  if (!ctx) {
    throw new Error('dHashRegion: no 2D context');
  }
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(source, x, y, w, h, 0, 0, 9, 8);
  const data = ctx.getImageData(0, 0, 9, 8).data;
  // Convert RGBA → grayscale luminance (Rec. 601).
  const gray = new Uint8Array(9 * 8);
  for (let i = 0; i < gray.length; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  // Row-pair difference → 64 bits → 16 hex chars.
  const bits: number[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = gray[row * 9 + col];
      const right = gray[row * 9 + col + 1];
      bits.push(left < right ? 1 : 0);
    }
  }
  let hex = '';
  for (let i = 0; i < bits.length; i += 4) {
    const nibble =
      (bits[i] << 3) | (bits[i + 1] << 2) | (bits[i + 2] << 1) | bits[i + 3];
    hex += nibble.toString(16);
  }
  return hex;
}

export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) {
    throw new Error('dHash hammingDistance: hash length mismatch');
  }
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    dist += POPCOUNT4(diff);
  }
  return dist;
}
