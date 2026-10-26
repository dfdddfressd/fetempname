export function median(values: number[]): number {
  if (values.length === 0) {
    throw new Error("median of an empty list");
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Modified z-score (Iglewicz and Hoaglin). Returns null when MAD is 0,
 * which means every point sits on the median and none is an outlier.
 */
export function modifiedZScores(values: number[]): Array<number | null> {
  const center = median(values);
  const deviations = values.map((value) => Math.abs(value - center));
  const mad = median(deviations);
  if (mad === 0) return values.map(() => null);
  return values.map((value) => (0.6745 * (value - center)) / mad);
}
