const M_TO_YD = 1.09361;

export function metersToYards(meters: number): number {
  return Math.round(meters * M_TO_YD);
}
