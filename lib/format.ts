import type { AnalyteCode } from "./types";

export function formatMeasurement(analyte: AnalyteCode, value: number): string {
  if (analyte === "pH") {
    return value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  }
  const rounded = Math.round(value * 10) / 10;
  return rounded.toLocaleString("en-US", {
    maximumFractionDigits: 1,
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
  });
}

export function csvNumber(value: number): number {
  if (Number.isInteger(value)) return value;
  return Math.round(value * 10000) / 10000;
}
