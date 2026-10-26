import { TI_FRACTION_OF_TIO2 } from "./schema";
import type { AnalyteCode } from "./types";

export interface CanonicalValue {
  value: number;
  unit: "mg/kg" | "pH";
}

export interface UnitFailure {
  error: string;
}

function cleanUnit(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/μ/g, "u");
}

/**
 * Convert a lab number into the canonical unit for that analyte.
 * Elemental results become mg/kg. pH stays on the pH scale.
 * ppm is treated as mg/kg, which is the usual meaning on a solid soil digest.
 * Solution units such as mg/L are rejected rather than guessed.
 */
export function toCanonical(
  analyte: AnalyteCode,
  value: number,
  unitRaw: string,
  oxide = false,
): CanonicalValue | UnitFailure {
  const unit = cleanUnit(unitRaw);

  if (analyte === "pH") {
    if (unit === "" || unit === "ph" || unit === "su" || unit === "s.u." || unit === "1" || unit === "unitless") {
      return { value, unit: "pH" };
    }
    return { error: `pH was reported in ${unitRaw.trim() || "an unrecognized unit"}` };
  }

  if (oxide || unit === "tio2%" || unit === "tio2wt%" || unit === "%tio2") {
    if (analyte !== "Ti") {
      return { error: `${analyte} was reported as TiO2, which this check only converts for titanium` };
    }
    if (unit !== "tio2%" && unit !== "tio2wt%" && unit !== "%tio2" && unit !== "%" && unit !== "wt%" && unit !== "percent") {
      return { error: `TiO2 was reported in ${unitRaw.trim() || "an unrecognized unit"}` };
    }
    return { value: (value / 100) * TI_FRACTION_OF_TIO2 * 1_000_000, unit: "mg/kg" };
  }

  if (unit === "mg/kg" || unit === "ppm" || unit === "ug/g" || unit === "mgkg") {
    return { value, unit: "mg/kg" };
  }
  if (unit === "g/kg") {
    return { value: value * 1000, unit: "mg/kg" };
  }
  if (unit === "%" || unit === "wt%" || unit === "percent" || unit === "mass%") {
    return { value: value * 10_000, unit: "mg/kg" };
  }
  if (unit === "mg/l" || unit === "ugl" || unit === "ug/l" || unit === "ppm(aq)" || unit === "meq/l" || unit === "mmol/l") {
    return {
      error: `${analyte} was reported in ${unitRaw.trim()}, a solution unit. Soil mass fraction needs mg/kg, ppm, or %`,
    };
  }
  if (!unit) {
    return { error: `${analyte} has a number but no unit` };
  }
  return { error: `${analyte} was reported in ${unitRaw.trim()}, which is not a soil mass-fraction unit this check accepts` };
}

const NUMBER_TEXT = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

/** True when the cell is a detection limit or a placeholder rather than a measurement. */
export function isNonNumericResult(raw: string): boolean {
  const value = raw.trim();
  if (!value) return false;
  if (NUMBER_TEXT.test(value.replace(/,/g, ""))) return false;
  return true;
}

export function parseNumber(raw: string): number | null {
  const value = raw.trim().replace(/,/g, "");
  if (!NUMBER_TEXT.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
