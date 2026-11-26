// The reference logic is Python, and its messages interpolate floats with str():
// 23.0 prints as "23.0", 12.4 as "12.4". Field values here are always floats,
// so mirror that to keep messages identical to the reference.
export function pyFloat(value: number): string {
  if (Number.isInteger(value)) return value.toFixed(1);
  return String(value);
}
